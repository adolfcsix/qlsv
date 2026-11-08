import { ensure } from '../../core/errors.js';
import {id, text, numeric} from '../../utils/validation.js';

import { writeAudit } from '../audit/audit.service.js';
import {required, duplicate} from '../operations/change-utils.js';
import { isCurriculumLocked } from '../curriculum/curriculum.repository.js';
export async function handleCatalog({ db, user, body, patches, p, a, b, n }) {
    const defs = { cohorts: ['cohorts', 'cohort_id', 'code'], departments: ['departments', 'department_id', 'department_code'], majors: ['majors', 'major_id', 'major_code'], programs: ['curricula', 'curriculum_id', 'code'], groups: ['student_groups', 'student_group_id', 'group_code'] };
    const def = defs[p.table];
    ensure(def, 'Không hỗ trợ cập nhật dữ liệu này.', 403, 'FORBIDDEN');
    const [table, pk, codeKey] = def;
    const old = n ? await required(db, table, pk, n) : null;
    if (old && table === 'curricula') {
        const version = await db.get(`SELECT 1 AS linked FROM curriculum_versions
            WHERE source_curriculum_id=? OR target_curriculum_id=? LIMIT 1`, [n,n]);
        ensure(!version && !await isCurriculumLocked(db,n),
            'Chương trình đã có phiên bản khác hoặc dữ liệu học tập; không được sửa/xóa trực tiếp.',
            409, 'CURRICULUM_VERSION_REQUIRED');
    }
    if (!a) {
        ensure(old, 'Không tìm thấy bản ghi.', 404);
        if (table === 'cohorts')
            ensure(!await db.get('SELECT curriculum_id FROM curricula WHERE admission_year=?', [old.admission_year]), 'Khóa còn chương trình liên quan.', 409);
        if (table === 'departments')
            ensure(!await db.get('SELECT major_id FROM majors WHERE department_id=?', [n]), 'Khoa còn ngành liên quan.', 409);
        if (table === 'majors')
            ensure(!await db.get('SELECT curriculum_id FROM curricula WHERE major_id=?', [n]), 'Ngành còn chương trình liên quan.', 409);
        if (table === 'curricula')
            ensure(!await db.get('SELECT student_group_id FROM student_groups WHERE curriculum_id=?', [n]), 'Chương trình còn lớp hành chính liên quan.', 409);
        if (table === 'student_groups') {
            ensure(!await db.get('SELECT student_id FROM students WHERE student_group_id=? LIMIT 1', [n]), 'Lớp đang có hồ sơ sinh viên. Hãy chuyển hồ sơ trước khi xóa.', 409);
            ensure(!await db.get('SELECT class_id FROM section_targets WHERE student_group_id=? LIMIT 1', [n]), 'Lớp đang là đối tượng của một lớp học phần. Hãy gỡ đối tượng trước.', 409);
            ensure(!await db.get('SELECT schedule_id FROM schedule_audiences WHERE student_group_id=? LIMIT 1',[n]), 'Lớp đang được xếp lịch theo buổi. Gỡ đối tượng buổi học trước.',409);
            await db.run('DELETE FROM group_settings WHERE student_group_id=?', [n]);
        }
        await db.run(`DELETE FROM ${table} WHERE ${pk}=?`, [n]);
        await writeAudit(db, user, 'DELETE_CATALOG', table, n, old);
        return true;
    }
    const values = { [codeKey]: text(a.code, 'Mã', 50), name: text(a.name, 'Tên', 200) };
    if (table === 'cohorts') {
        values.admission_year = numeric(a.year, 1950, 2100, 'Năm tuyển sinh');
        ensure(Number.isInteger(values.admission_year), 'Năm tuyển sinh phải là số nguyên.');
        if (old && old.admission_year !== values.admission_year)
            ensure(!await db.get('SELECT curriculum_id FROM curricula WHERE admission_year=?', [old.admission_year]), 'Khóa đã có chương trình, không đổi năm.', 409);
    }
    if (table === 'majors') {
        await required(db, 'departments', 'department_id', a.departmentId);
        values.department_id = id(a.departmentId);
        if (old && old.department_id !== values.department_id)
            ensure(!await db.get('SELECT curriculum_id FROM curricula WHERE major_id=?', [n]), 'Ngành đã có chương trình.', 409);
    }
    if (table === 'curricula') {
        const major = await required(db, 'majors', 'major_id', a.majorId), cohort = await required(db, 'cohorts', 'cohort_id', a.cohortId), policy = old ? { policy_id: old.policy_id } : await db.get('SELECT policy_id FROM academic_policies WHERE approved_by IS NOT NULL ORDER BY policy_id LIMIT 1');
        ensure(policy, 'Chưa có quy chế được duyệt.');
        Object.assign(values, { major_id: major.major_id, policy_id: policy.policy_id, admission_year: cohort.admission_year, required_credits: numeric(a.credits, 1, 300, 'Tín chỉ') });
        if (old && (old.major_id !== values.major_id || old.admission_year !== values.admission_year || old.required_credits !== values.required_credits))
            ensure(!await db.get('SELECT student_group_id FROM student_groups WHERE curriculum_id=?', [n]), 'Chương trình đã có lớp, cần tạo phiên bản mới.', 409);
    }
    if (table === 'student_groups') {
        await required(db, 'curricula', 'curriculum_id', a.programId);
        values.curriculum_id = id(a.programId);
        values.advisor_lecturer_id = a.advisor ? id(a.advisor) : null;
        if (a.advisor)
            await required(db, 'lecturers', 'lecturer_id', a.advisor);
        if (old && old.curriculum_id !== values.curriculum_id)
            ensure(!await db.get('SELECT student_id FROM students WHERE student_group_id=?', [n]), 'Lớp đã có sinh viên, không đổi chương trình.', 409);
    }
    await duplicate(db, table, codeKey, values[codeKey], pk, n);
    let capacity;
    if (table === 'student_groups') {
        const setting = old ? await db.get('SELECT capacity FROM group_settings WHERE student_group_id=?', [n]) : null;
        capacity = numeric(a.capacity ?? setting?.capacity ?? 50, 1, 1000, 'Sĩ số tối đa');
        ensure(Number.isInteger(capacity), 'Sĩ số tối đa phải là số nguyên.');
        const occupied = old ? await db.get("SELECT COUNT(*) AS n FROM students WHERE student_group_id=? AND status NOT IN ('withdrawn','graduated')", [n]) : {n:0};
        ensure(capacity >= Number(occupied.n), 'Sĩ số tối đa không được thấp hơn số sinh viên hiện có.', 409);
    }
    const rowId = n || await db.insert(table, values);
    if (n)
        await db.update(table, pk, n, values);
    if (table === 'student_groups') {
        const existing = await db.get('SELECT capacity FROM group_settings WHERE student_group_id=?', [rowId]);
        if (existing) await db.update('group_settings', 'student_group_id', rowId, {capacity});
        else await db.insert('group_settings', {student_group_id:rowId,capacity});
    }
    await writeAudit(db, user, n ? 'UPDATE_CATALOG' : 'CREATE_CATALOG', table, rowId, old, values);
    return true;
}
