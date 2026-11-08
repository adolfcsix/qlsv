import { seed } from './data.js';
const KEY = 'hocvu-demo-v1';
let memory;
export function read() { if (memory)
    return memory; try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? JSON.parse(raw) : seed();
    if (memory.version !== 1)
        memory = seed();
}
catch {
    memory = seed();
} return memory; }
export function save(db) { try {
    localStorage.setItem(KEY, JSON.stringify(db));
    memory = db;
}
catch {
    throw new Error('Trình duyệt không thể lưu dữ liệu. Hãy kiểm tra dung lượng hoặc chế độ riêng tư.');
} }
export function uid(prefix = 'id') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
export function transact(fn) { const db = structuredClone(read()); const result = fn(db); save(db); return result; }
export function audit(db, actor, action, detail) { db.audit.unshift({ id: uid('au'), date: new Date().toISOString(), actor, action, detail }); }
export function upsert(table, item) { return transact(db => { const duplicate = db[table].find(x => x.id !== item.id && (item.code && x.code.toLocaleLowerCase() === item.code.toLocaleLowerCase())); if (duplicate)
    throw new Error('Mã này đã tồn tại. Vui lòng chọn mã khác.'); const i = db[table].findIndex(x => x.id === item.id); if (i < 0)
    db[table].push(item);
else
    db[table][i] = { ...db[table][i], ...item }; return item; }); }
export function remove(table, id) { return transact(db => { const refs = { cohorts: [['programs', 'cohortId']], departments: [['majors', 'departmentId'], ['lecturers', 'departmentId']], majors: [['programs', 'majorId']], programs: [['groups', 'programId']], groups: [['students', 'groupId']], subjects: [['classes', 'subjectId']], lecturers: [['classes', 'lecturerId'], ['groups', 'advisor']] }; const related = (refs[table] || []).flatMap(([t, k]) => db[t].filter(x => x[k] === id)); if (related.length)
    throw new Error(`Chưa thể xóa: có ${related.length} bản ghi liên quan. Hãy giữ dữ liệu để bảo toàn lịch sử.`); db[table] = db[table].filter(x => x.id !== id); }); }
export function getContext(db, student) { const group = db.groups.find(x => x.id === student.groupId); const program = db.programs.find(x => x.id === group?.programId); const major = db.majors.find(x => x.id === program?.majorId); const department = db.departments.find(x => x.id === major?.departmentId); const cohort = db.cohorts.find(x => x.id === program?.cohortId); return { group, program, major, department, cohort }; }
export function balance(db, studentId) { const charges = db.charges.filter(x => x.studentId === studentId); const total = charges.reduce((s, x) => s + Number(x.amount), 0); const paid = db.receipts.filter(x => x.status === 'active' && charges.some(c => c.id === x.chargeId)).reduce((s, x) => s + Number(x.amount), 0); return { total, paid, due: total - paid }; }
export function summary(db, studentId) { const results = db.results.filter(x => x.studentId === studentId && x.status === 'passed'); const unique = [...new Map(results.map(x => [x.code, x])).values()]; const credits = unique.reduce((s, x) => s + x.credits, 0); return { credits, gpa: credits ? unique.reduce((s, x) => s + x.credits * x.gpa, 0) / credits : null, current: db.enrollments.filter(x => x.studentId === studentId && ['registered', 'studying'].includes(x.status)).reduce((s, x) => s + (db.subjects.find(z => z.id === db.classes.find(c => c.id === x.classId)?.subjectId)?.credits || 0), 0) }; }
export function register(db, studentId, classIds) { const student = db.students.find(x => x.id === studentId); if (student?.status !== 'studying')
    throw new Error('Trạng thái sinh viên hiện tại không cho phép đăng ký.'); if (!classIds.length)
    throw new Error('Hãy chọn ít nhất một lớp.'); const existing = db.enrollments.filter(x => x.studentId === studentId && ['studying', 'registered'].includes(x.status)).map(x => db.classes.find(c => c.id === x.classId)); const selected = classIds.map(id => db.classes.find(c => c.id === id)); if (selected.some(x => !x))
    throw new Error('Lớp học phần không tồn tại.'); for (const c of selected) {
    if (c.count >= c.capacity)
        throw new Error(`${c.code} đã đủ sĩ số.`);
    if (existing.some(x => x.id === c.id || x.subjectId === c.subjectId))
        throw new Error(`${c.code}: đã có đăng ký cho học phần này.`);
} const all = [...existing, ...selected]; for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (a.day === b.day && a.start < b.end && b.start < a.end)
            throw new Error(`Trùng lịch: ${a.code} và ${b.code}.`);
        if (a.subjectId === b.subjectId)
            throw new Error('Không đăng ký hai lớp của cùng học phần.');
    } for (const c of selected) {
    db.enrollments.push({ id: uid('en'), studentId, classId: c.id, type: db.results.some(x => x.studentId === studentId && x.code === db.subjects.find(s => s.id === c.subjectId)?.code) ? 'repeat' : 'first', status: 'studying' });
    c.count++;
} }
export function collect(db, chargeId, amount, method) { const charge = db.charges.find(x => x.id === chargeId); if (!charge)
    throw new Error('Không tìm thấy khoản thu.'); const paid = db.receipts.filter(x => x.chargeId === chargeId && x.status === 'active').reduce((s, x) => s + x.amount, 0); if (!Number.isSafeInteger(amount) || amount <= 0 || amount > charge.amount - paid)
    throw new Error('Số tiền phải là số nguyên dương và không vượt công nợ.'); const receipt = { id: uid('rc'), code: `PT-${String(db.receipts.length + 1).padStart(4, '0')}`, chargeId, amount, method, date: new Date().toISOString().slice(0, 10), status: 'active', reason: '' }; db.receipts.push(receipt); return receipt; }
// Adapter demo. Khi nối backend: thay hàm đọc/ghi bằng fetch và validation ở server.
// Dữ liệu localStorage và phân quyền phía client chỉ phục vụ trình diễn, không phải bảo mật.
