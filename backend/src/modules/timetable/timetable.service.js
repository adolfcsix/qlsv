import { scheduleRows } from '../scheduling/scheduling.repository.js';
import { ensure } from '../../core/errors.js';
import { weekDefinitions } from './timetable.repository.js';

const isoDate = d => d.toISOString().slice(0, 10);
export function parseWeekStart(value) {
    ensure(/^\d{4}-\d{2}-\d{2}$/.test(value || ''), 'Ngày đầu tuần không hợp lệ.');
    const d = new Date(`${value}T00:00:00Z`);
    ensure(!Number.isNaN(d.getTime()) && isoDate(d) === value && d.getUTCDay() === 1,
        'Ngày bắt đầu phải là thứ Hai hợp lệ.');
    return d;
}

export async function getPersonalWeek(db, user, startText) {
    ensure(['STUDENT','LECTURER'].includes(user.role), 'Chỉ sinh viên hoặc giảng viên xem lịch cá nhân.', 403, 'FORBIDDEN');
    const day = parseWeekStart(startText);
    const endDate = new Date(day);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const end = isoDate(endDate);
    const { rows, examRows } = await weekDefinitions(db, user, startText, end);
    const dates = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(day);
        date.setUTCDate(date.getUTCDate() + index);
        return isoDate(date);
    });
    const items = [];
    const sessions = new Map((await scheduleRows(db)).map(row=>[row.id,row]));
    const targets = await db.all('SELECT * FROM section_targets');
    const student = user.role === 'STUDENT' ? await db.get('SELECT student_group_id FROM students WHERE user_id=?',[user.user_id]) : null;
    for (const row of rows) {
        const date = dates[Number(row.day) - 1];
        if (!date || date < String(row.fromDate).slice(0, 10) || date > String(row.toDate).slice(0, 10)) continue;
        items.push({ id: String(row.id), classId: String(row.classId),
            classCode: row.classCode, subject: row.subject, subjectCode: row.subjectCode,
            date, start: String(row.start).slice(0, 5), end: String(row.end).slice(0, 5),
            room: row.room, type: 'study', from: String(row.fromDate).slice(0,10), to:String(row.toDate).slice(0,10), periods:sessions.get(String(row.id))?.periods||null, teachers: sessions.get(String(row.id))?.teacherNames || [],
            external: !!student && targets.some(t=>String(t.class_id)===String(row.classId)) && !targets.some(t=>String(t.class_id)===String(row.classId)&&t.student_group_id===student.student_group_id) });
    }
    const types = { regular: 'Chính thức', resit: 'Thi lại', deferred: 'Thi bù' };
    for (const row of examRows) items.push({ id: String(row.id), classId: String(row.classId),
        classCode: row.classCode, subject: row.subject, subjectCode: row.subjectCode,
        date: String(row.date).slice(0, 10), start: String(row.start).slice(0, 5),
        end: String(row.end).slice(0, 5), room: row.room, type: 'exam',
        examType: types[row.examType] || 'Kỳ thi' });
    items.sort((a, b) => `${a.date} ${a.start} ${a.classCode}`.localeCompare(`${b.date} ${b.start} ${b.classCode}`));
    return { start: startText, end, items };
}
