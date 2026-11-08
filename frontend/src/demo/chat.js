import { localIntent, norm } from '../../../shared/lookup-intents.js';
import { getContext, balance } from '../services/repository.js';
const fail = message => { throw new Error(message); };
export function demoChat(ctx, message, context = {}) {
    const { db, user } = ctx, args = localIntent(message, context), org = ['academic', 'sysadmin'].includes(user.role);
    let title = 'Chatbot Lac Hong', reply = '', rows = [], columns = [], links = [], sources = [], total = 0;
    const scope = db.students.filter(s => org || user.role === 'student' && s.id === user.profileId || user.role === 'lecturer' && getContext(db, s).group?.advisor === user.profileId);
    const filtered = scope.filter(s => { const c = getContext(db, s); return (!args.cohort || c.cohort?.year === Number(args.cohort)) && (!args.major || norm(c.major?.name) === norm(args.major)) && (!args.status || s.status === args.status) && (!args.name || norm(s.name).includes(norm(args.name))); });
    if (['cohort_classes', 'unassigned', 'summary', 'unpaid'].includes(args.intent) && !org)
        fail('Thông tin tổng hợp này dành cho cán bộ có quyền.');
    if (args.intent === 'cohort_classes' || args.intent === 'unassigned') {
        const groups = db.groups.filter(g => { const p = db.programs.find(p => p.id === g.programId), m = db.majors.find(m => m.id === p?.majorId), c = db.cohorts.find(c => c.id === p?.cohortId); return (!args.cohort || c?.year === Number(args.cohort)) && (!args.major || norm(m?.name) === norm(args.major)) && (args.intent !== 'unassigned' || !g.advisor); });
        rows = groups.map(g => ({ code: g.code, name: g.name, count: db.students.filter(s => s.groupId === g.id).length }));
        columns = [['code', 'Mã lớp'], ['name', 'Tên lớp'], ['count', 'Sinh viên']];
        total = rows.length;
        reply = `${args.cohort ? 'Khóa ' + args.cohort : 'Phạm vi tra cứu'} có ${total} lớp hành chính${args.major ? ' thuộc ngành ' + args.major : ''}${args.intent === 'unassigned' ? ' chưa phân công cố vấn' : ''}. Bạn có thể hỏi tiếp về sĩ số của một lớp.`;
        sources = ['student_groups', 'curricula'];
    }
    else if (args.intent === 'class_students') {
        const group = db.groups.find(g => norm(g.code).replaceAll(' ', '') === norm(args.groupCode).replaceAll(' ', ''));
        if (!group)
            fail('Chưa tìm thấy mã lớp này.');
        if (!org && user.role === 'lecturer' && group.advisor !== user.profileId || user.role === 'student' && !scope.some(s => s.groupId === group.id))
            fail('Lớp không thuộc phạm vi của bạn.');
        const list = db.students.filter(s => s.groupId === group.id);
        total = list.length;
        reply = `Lớp ${group.code} có ${total} sinh viên trong dữ liệu mẫu.`;
        if (org || user.role === 'lecturer') {
            rows = list.map(s => ({ code: s.code, name: s.name, status: s.status }));
            columns = [['code', 'Mã sinh viên'], ['name', 'Họ tên'], ['status', 'Trạng thái']];
        }
        sources = ['students', 'student_groups'];
    }
    else if (['student_profile', 'student_transcript'].includes(args.intent)) {
        if (user.role === 'sysadmin')
            fail('Quản trị tài khoản không có quyền xem hồ sơ học tập và bảng điểm.');
        const s = scope.find(s => norm(s.code) === norm(args.studentCode));
        if (!s)
            fail('Không tìm thấy mã sinh viên trong phạm vi của bạn.');
        if (args.intent === 'student_profile') {
            rows = [{ code: s.code, name: s.name, group: getContext(db, s).group?.name, status: s.status }];
            columns = [['code', 'Mã sinh viên'], ['name', 'Họ tên'], ['group', 'Lớp'], ['status', 'Trạng thái']];
            reply = `${s.name}, mã ${s.code}, thuộc ${getContext(db, s).group?.name}. Bạn muốn xem bảng điểm của sinh viên này không?`;
            sources = ['students', 'student_groups'];
        }
        else {
            rows = db.results.filter(r => r.studentId === s.id);
            columns = [['code', 'Học phần'], ['name', 'Tên học phần'], ['score', 'Điểm'], ['credits', 'Tín chỉ']];
            reply = `Đây là ${rows.length} kết quả học tập của ${s.name} trong dữ liệu mẫu. Mở hồ sơ để kiểm tra từng lần học.`;
            sources = ['course_results', 'enrollments'];
        }
        total = rows.length;
        links = [{ label: 'Mở hồ sơ ' + s.code, href: `/${user.role}/profile/${s.id}/${user.role === 'student' ? 'personal' : 'overview'}` }];
    }
    else if (args.intent === 'student_search' || args.intent === 'unpaid') {
        if (args.intent === 'unpaid' && user.role !== 'academic')
            fail('Chỉ cán bộ có quyền tài chính được tra cứu công nợ.');
        const list = args.intent === 'unpaid' ? filtered.filter(s => balance(db, s.id).due > 0) : filtered;
        rows = list.map(s => ({ code: s.code, name: s.name, group: getContext(db, s).group?.name, status: s.status, ...(args.intent === 'unpaid' ? { due: balance(db, s.id).due } : {}) }));
        columns = [['code', 'Mã sinh viên'], ['name', 'Họ tên'], ['group', 'Lớp'], ['status', 'Trạng thái'], ...(args.intent === 'unpaid' ? [['due', 'Còn thiếu']] : [])];
        total = rows.length;
        reply = `Tôi tìm thấy ${total} sinh viên${args.intent === 'unpaid' ? ' còn công nợ' : ''} phù hợp. Bạn có thể hỏi thông tin hoặc bảng điểm theo mã sinh viên.`;
        sources = ['students', ...(args.intent === 'unpaid' ? ['charges', 'receipts'] : [])];
    }
    else if (args.intent === 'summary') {
        rows = [{ name: 'Sinh viên', count: db.students.length }, { name: 'Lớp hành chính', count: db.groups.length }, { name: 'Khoa', count: db.departments.length }, { name: 'Ngành', count: db.majors.length }];
        columns = [['name', 'Đối tượng'], ['count', 'Số lượng']];
        total = rows.length;
        reply = 'Đây là tổng quan từ bộ dữ liệu mẫu hiện tại.';
        sources = ['students', 'student_groups'];
    }
    else
        reply = /^(chao|xin chao|hi|hello)\b/.test(norm(message)) ? 'Chào bạn! Tôi là chatbot Lac Hong. Bạn cần tìm thông tin khóa, lớp hay hồ sơ sinh viên?' : 'Bạn có thể hỏi “Khóa K24 có bao nhiêu lớp?”, “Lớp CNTT K24A có bao nhiêu sinh viên?” hoặc “Bảng điểm 20240001”. Bạn muốn tra cứu mục nào?';
    return { result: { title, reply, message: reply, rows: rows.slice(0, 100), columns: columns.map(([key, label]) => ({ key, label })), links, sources: sources.map(table => ({ table, label: table })), total, asOf: new Date().toISOString(), query: args }, mode: 'demo_lookup' };
}
