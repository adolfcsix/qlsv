import {ensure} from '../../core/errors.js';
import {id,text} from '../../utils/validation.js';
import {canStudent} from '../../middlewares/authorize.js';
import {norm,allowedIntents} from '../../../../shared/lookup-intents.js';

export const roleCanOrg = u => ['ACADEMIC_STAFF', 'ADMIN'].includes(u.role);

export const baseJoin = ' FROM student_groups g JOIN curricula p ON p.curriculum_id=g.curriculum_id JOIN majors m ON m.major_id=p.major_id JOIN departments d ON d.department_id=m.department_id';

export function groupFilter(args) {
    const conditions = [], params = [];
    if (args.cohort) {
        ensure(/^20\d{2}$/.test(String(args.cohort)), 'Khóa tuyển sinh cần là năm 20xx.');
        conditions.push('p.admission_year=?');
        params.push(Number(args.cohort));
    }
    if (args.major) {
        conditions.push('(LOWER(m.name)=LOWER(?) OR LOWER(m.major_code)=LOWER(?))');
        params.push(text(args.major, 'Ngành', 200), args.major);
    }
    return { where: conditions.length ? ' WHERE ' + conditions.join(' AND ') : '', params };
}

export async function enforceStudent(db, user, code) { ensure(code && /^[A-Za-z0-9_-]{3,30}$/.test(code), 'Vui lòng cung cấp mã sinh viên đầy đủ.'); const s = await db.get('SELECT student_id FROM students WHERE LOWER(student_code)=LOWER(?)', [code]); ensure(s, 'Không tìm thấy sinh viên có mã này.', 404, 'STUDENT_NOT_FOUND'); ensure(await canStudent(db, user, s.student_id), 'Bạn không có quyền xem hồ sơ hoặc bảng điểm này.', 403, 'FORBIDDEN'); return s.student_id; }

export async function executeLookup(db, user, args) {
    ensure(allowedIntents.includes(args.intent), 'Công cụ không được phép.');
    let columns = [], rows = [], title = '', total = 0, sources = [], links = [], message = '', filters = {};
    args = { ...args };
    if (/^k\d{2}$/i.test(args.cohort || ''))
        args.cohort = '20' + args.cohort.slice(1);
    const alias = { cntt: 'Công nghệ thông tin', ktpm: 'Kỹ thuật phần mềm', qtkd: 'Quản trị kinh doanh', kt: 'Kế toán', nna: 'Ngôn ngữ Anh' };
    if (alias[norm(args.major)])
        args.major = alias[norm(args.major)];
    const { where, params } = groupFilter(args);
    filters = { ...(args.cohort ? { khóa: args.cohort } : {}), ...(args.major ? { ngành: args.major } : {}) };
    if (['cohort_classes', 'unassigned', 'unpaid', 'summary'].includes(args.intent))
        ensure(roleCanOrg(user), 'Tra cứu tổng hợp này dành cho cán bộ và quản trị.', 403, 'FORBIDDEN');
    if (args.intent === 'cohort_classes' || args.intent === 'unassigned') {
        const condition = where + (args.intent === 'unassigned' ? (where ? ' AND ' : ' WHERE ') + 'g.advisor_lecturer_id IS NULL' : '');
        const count = await db.get('SELECT COUNT(*) AS total' + baseJoin + condition, params);
        total = Number(count.total);
        rows = await db.all('SELECT g.student_group_id AS id,g.group_code AS code,g.name AS name,p.admission_year AS year,m.name AS major,(SELECT COUNT(*) FROM students s WHERE s.student_group_id=g.student_group_id) AS students' + baseJoin + condition + ' ORDER BY p.admission_year DESC,g.group_code LIMIT 100', params);
        columns = [['code', 'Mã lớp'], ['name', 'Lớp hành chính'], ['year', 'Khóa'], ['major', 'Ngành'], ['students', 'Sinh viên']];
        title = args.intent === 'unassigned' ? 'Lớp chưa có cố vấn' : 'Lớp hành chính theo khóa';
        message = `Có ${total} lớp hành chính phù hợp${total > 100 ? '; đang hiển thị 100 lớp đầu' : ''}.`;
        sources = ['student_groups', 'curricula', 'majors', 'students'];
        links = rows.map(r => ({ label: r.code, href: '/academic/group/' + r.id }));
        if (user.role === 'ADMIN')
            links = [];
    }
    else if (args.intent === 'class_students') {
        ensure(args.groupCode, 'Vui lòng ghi rõ lớp, ví dụ CNTT K24A.');
        const groups = await db.all("SELECT g.*" + baseJoin + " WHERE REPLACE(LOWER(g.group_code),' ','')=REPLACE(LOWER(?),' ','')", [text(args.groupCode, 'Mã lớp', 50)]);
        ensure(groups.length, 'Không tìm thấy lớp hành chính này.', 404, 'CLASS_NOT_FOUND');
        ensure(groups.length === 1, 'Tên lớp chưa rõ. Vui lòng cung cấp mã lớp chính xác.');
        const g = groups[0];
        if (user.role === 'LECTURER')
            ensure(await db.get('SELECT lecturer_id FROM lecturers WHERE lecturer_id=? AND user_id=?', [g.advisor_lecturer_id, user.user_id]), 'Lớp không thuộc phân công cố vấn.', 403);
        if (user.role === 'STUDENT')
            ensure(await db.get('SELECT student_id FROM students WHERE student_group_id=? AND user_id=?', [g.student_group_id, user.user_id]), 'Không có quyền tra cứu lớp này.', 403);
        const counts = await db.all('SELECT status,COUNT(*) AS count FROM students WHERE student_group_id=? GROUP BY status', [g.student_group_id]);
        total = counts.reduce((s, r) => s + Number(r.count), 0);
        title = 'Sĩ số lớp ' + g.group_code;
        message = `Lớp có ${total} sinh viên. ` + counts.map(r => `${({ studying: 'đang học', on_leave: 'bảo lưu', suspended: 'đình chỉ', withdrawn: 'thôi học', graduated: 'tốt nghiệp' })[r.status] || r.status}: ${r.count}`).join('; ');
        filters = { lớp: g.group_code };
        if (user.role === 'ACADEMIC_STAFF' || user.role === 'LECTURER') {
            rows = await db.all('SELECT student_id AS id,student_code AS code,full_name AS name,status FROM students WHERE student_group_id=? ORDER BY student_code LIMIT 100', [g.student_group_id]);
            columns = [['code', 'Mã sinh viên'], ['name', 'Họ và tên'], ['status', 'Trạng thái']];
            if (user.role === 'ACADEMIC_STAFF' || user.role === 'LECTURER')
                links = rows.map(r => ({ label: r.code, href: `/${user.role === 'LECTURER' ? 'lecturer' : 'academic'}/profile/${r.id}/overview` }));
        }
        sources = ['students', 'student_groups'];
    }
    else if (args.intent === 'student_search') {
        ensure(user.role !== 'ADMIN', 'Quản trị hệ thống không được xem danh sách hồ sơ sinh viên.', 403, 'FORBIDDEN');
        let condition = where, bind = [...params];
        const add = (sql, ...values) => { condition += (condition ? ' AND ' : ' WHERE ') + sql; bind.push(...values); };
        if (args.status) {
            ensure(['studying', 'on_leave', 'suspended', 'withdrawn', 'graduated'].includes(args.status), 'Trạng thái không hợp lệ.');
            add('s.status=?', args.status);
            filters.trạng_thái = args.status;
        }
        if (args.name) {
            const name = text(args.name, 'Họ tên', 100);
            const pattern = (db.driver === 'sqlite' ? norm(name) : name).replace(/[!%_]/g, '!$&');
            add((db.driver === 'sqlite' ? 'QLSV_NORMALIZE(s.full_name)' : 's.full_name') + " LIKE ? ESCAPE '!'", '%' + pattern + '%');
            filters.họ_tên = name;
        }
        if (user.role === 'STUDENT')
            add('s.user_id=?', user.user_id);
        else if (user.role === 'LECTURER')
            add('g.advisor_lecturer_id IN (SELECT lecturer_id FROM lecturers WHERE user_id=?)', user.user_id);
        const join = ' FROM students s JOIN student_groups g ON g.student_group_id=s.student_group_id JOIN curricula p ON p.curriculum_id=g.curriculum_id JOIN majors m ON m.major_id=p.major_id';
        total = Number((await db.get('SELECT COUNT(*) AS total' + join + condition, bind)).total);
        rows = await db.all('SELECT s.student_id AS id,s.student_code AS code,s.full_name AS name,g.group_code AS class,m.name AS major,p.admission_year AS year,s.status' + join + condition + ' ORDER BY s.student_code LIMIT 100', bind);
        columns = [['code', 'Mã sinh viên'], ['name', 'Họ và tên'], ['class', 'Lớp'], ['major', 'Ngành'], ['year', 'Khóa'], ['status', 'Trạng thái']];
        title = 'Danh sách sinh viên';
        message = `Có ${total} sinh viên phù hợp; hiển thị ${rows.length} hồ sơ trong phạm vi quyền của bạn.`;
        sources = ['students', 'student_groups', 'curricula', 'majors'];
        if (user.role !== 'ADMIN')
            links = rows.map(r => ({ label: r.code, href: `/${user.role === 'STUDENT' ? 'student' : user.role === 'LECTURER' ? 'lecturer' : 'academic'}/profile/${r.id}/overview` }));
    }
    else if (args.intent === 'student_profile') {
        const studentId = await enforceStudent(db, user, args.studentCode);
        rows = await db.all('SELECT s.student_id AS id,s.student_code AS code,s.full_name AS name,s.status,s.date_of_birth AS dob,s.email,s.phone,g.group_code AS class,m.name AS major,p.admission_year AS year FROM students s JOIN student_groups g ON g.student_group_id=s.student_group_id JOIN curricula p ON p.curriculum_id=g.curriculum_id JOIN majors m ON m.major_id=p.major_id WHERE s.student_id=?', [studentId]);
        columns = [['code', 'Mã sinh viên'], ['name', 'Họ và tên'], ['class', 'Lớp'], ['major', 'Ngành'], ['year', 'Khóa'], ['status', 'Trạng thái']];
        title = 'Hồ sơ sinh viên ' + args.studentCode;
        message = rows[0].name + ' · ' + rows[0].class;
        total = rows.length;
        sources = ['students', 'student_groups', 'curricula', 'majors'];
        links = [{ label: 'Mở hồ sơ', href: `/${user.role === 'STUDENT' ? 'student' : user.role === 'LECTURER' ? 'lecturer' : 'academic'}/profile/${studentId}/overview` }];
    }
    else if (args.intent === 'student_transcript') {
        const studentId = await enforceStudent(db, user, args.studentCode);
        rows = await db.all("SELECT r.result_id AS id,su.subject_code AS code,su.name,sm.name AS semester,y.name AS year,e.enrollment_type AS attempt,r.credits_snapshot AS credits,r.total_score AS score,r.grade_point AS gpa,r.letter_grade AS letter,r.outcome,r.is_published AS published FROM course_results r JOIN enrollments e ON e.enrollment_id=r.enrollment_id JOIN classes c ON c.class_id=e.class_id JOIN subjects su ON su.subject_id=c.subject_id JOIN semesters sm ON sm.semester_id=c.semester_id JOIN academic_years y ON y.academic_year_id=sm.academic_year_id WHERE e.student_id=? AND r.is_published=1 ORDER BY sm.start_date,c.class_code LIMIT 100", [studentId]);
        columns = [['code', 'Mã học phần'], ['name', 'Học phần'], ['year', 'Năm học'], ['semester', 'Học kỳ'], ['attempt', 'Lần học'], ['credits', 'TC'], ['score', 'Thang 10'], ['gpa', 'Thang 4'], ['outcome', 'Kết quả']];
        title = 'Bảng điểm ' + args.studentCode;
        total = Number((await db.get('SELECT COUNT(*) AS total FROM course_results r JOIN enrollments e ON e.enrollment_id=r.enrollment_id WHERE e.student_id=? AND r.is_published=1', [studentId])).total);
        message = `Hiển thị ${rows.length}/${total} kết quả đã công bố; bảng giữ từng lần học. Không tự suy ra GPA chính thức từ quy chế chưa được xác nhận.`;
        sources = ['enrollments', 'course_results', 'subjects', 'semesters'];
        links = [{ label: 'Mở kết quả & tiến độ', href: `/${user.role === 'STUDENT' ? 'student' : user.role === 'LECTURER' ? 'lecturer' : 'academic'}/profile/${studentId}/progress` }];
    }
    else if (args.intent === 'unpaid') {
        ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ có quyền tài chính được tra cứu công nợ.', 403);
        const join = ' FROM charges ch JOIN students s ON s.student_id=ch.student_id JOIN student_groups g ON g.student_group_id=s.student_group_id JOIN curricula p ON p.curriculum_id=g.curriculum_id JOIN majors m ON m.major_id=p.major_id';
        const query = 'SELECT s.student_id AS id,s.student_code AS code,s.full_name AS name,g.group_code AS class,SUM(ch.amount-COALESCE((SELECT SUM(r.amount) FROM receipts r WHERE r.charge_id=ch.charge_id AND r.status=\'active\'),0)) AS due' + join + where + ' GROUP BY s.student_id,s.student_code,s.full_name,g.group_code HAVING due>0';
        rows = await db.all(query + ' ORDER BY s.student_code LIMIT 100', params);
        const count = await db.get('SELECT COUNT(*) AS total FROM (' + query + ') AS unpaid', params);
        total = Number(count.total);
        columns = [['code', 'Mã sinh viên'], ['name', 'Họ và tên'], ['class', 'Lớp'], ['due', 'Còn thiếu (đồng)']];
        title = 'Sinh viên còn nợ học phí';
        message = `Có ${total} sinh viên còn công nợ phù hợp. Học phí là phần mở rộng ngoài QLSV gốc.`;
        sources = ['charges', 'receipts', 'students', 'student_groups'];
        links = rows.map(r => ({ label: r.code, href: `/academic/profile/${r.id}/fees` }));
    }
    else if (args.intent === 'summary') {
        for (const [table, label] of [['students', 'Sinh viên'], ['student_groups', 'Lớp hành chính'], ['departments', 'Khoa'], ['majors', 'Ngành'], ['curricula', 'Chương trình']]) {
            const r = await db.get(`SELECT COUNT(*) AS n FROM ${table}`);
            rows.push({ label, count: Number(r.n) });
        }
        columns = [['label', 'Đối tượng'], ['count', 'Số lượng']];
        title = 'Tổng quan dữ liệu QLSV';
        message = 'Số liệu hiện tại từ cơ sở dữ liệu.';
        total = rows.length;
        sources = ['students', 'student_groups', 'departments', 'majors', 'curricula'];
    }
    else {
        title = 'Trợ lý tra cứu học vụ';
        message = 'Bạn có thể hỏi: “Khóa K24 có bao nhiêu lớp?”, “Lớp CNTT K24A có bao nhiêu sinh viên?”, “Thông tin sinh viên 20240001”, “Bảng điểm 20240001”, “Lớp nào chưa có cố vấn?”. Quyền tra cứu được kiểm tra trên máy chủ.';
    }
    return { title, message, columns: columns.map(([key, label]) => ({ key, label })), rows, total, filters, sources: sources.map(table => ({ table, label: table })), links, asOf: isoNow(), limit: 100 };
}

export function isoNow() { return new Date().toISOString(); }
