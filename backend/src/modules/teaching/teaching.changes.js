import { validateSchedule } from '../scheduling/scheduling.service.js';
import { ensure } from '../../core/errors.js';
import {text, numeric, timeOnly} from '../../utils/validation.js';

import { writeAudit } from '../audit/audit.service.js';
import {required, duplicate} from '../operations/change-utils.js';
import { registrationNow } from '../enrollments/enrollment-lifecycle.service.js';
export async function handleClass({ db, user, body, patches, p, a, b, n }) {
    ensure(a && !b, 'Chỉ mở lớp ở biểu mẫu này.');
    const su = await required(db, 'subjects', 'subject_id', a.subjectId), lect = await required(db, 'lecturers', 'lecturer_id', a.lecturerId);
    const now = registrationNow();
    const se = await db.get("SELECT * FROM semesters WHERE registration_start<=? AND registration_end>=? ORDER BY semester_id LIMIT 1", [now, now]);
    ensure(se, 'Không có học kỳ đang mở đăng ký.');
    const capacity = numeric(a.capacity, 1, 500, 'Sức chứa');
    ensure(Number.isInteger(capacity), 'Sức chứa phải nguyên.');
    const day = numeric(a.day, 1, 7, 'Thứ');
    ensure(Number.isInteger(day), 'Thứ phải là số nguyên từ 1 đến 7.');
    ensure(timeOnly(a.end) > timeOnly(a.start), 'Giờ học không hợp lệ.');
    const room = await db.get('SELECT * FROM rooms WHERE room_code=?', [text(a.room, 'Phòng', 40)]);
    ensure(room && room.capacity >= capacity, 'Phòng không tồn tại hoặc sức chứa không đủ.');
    await validateSchedule(db,{class_id:-1,semester_id:se.semester_id,capacity},{day,start:a.start,end:a.end,from:se.start_date,to:se.end_date,roomId:String(room.room_id),teacherIds:[String(lect.lecturer_id)]});
    const code = text(a.code, 'Mã lớp', 50);
    await duplicate(db, 'classes', 'class_code', code, 'class_id', null);
    const rowId = await db.insert('classes', { class_code: code, subject_id: su.subject_id, lecturer_id: lect.lecturer_id, semester_id: se.semester_id, capacity, status: 'open' });
    await db.insert('class_schedules', { class_id: rowId, room_id: room.room_id, day_of_week: day, start_time: a.start + ':00', end_time: a.end + ':00', start_date: se.start_date, end_date: se.end_date });
    for (const [name, type, weight] of [['Quá trình', 'process', 20], ['Giữa kỳ', 'midterm', 30], ['Cuối kỳ', 'final', 50]])
        await db.insert('assessments', { class_id: rowId, name, assessment_type: type, weight, max_score: 10 });
    await writeAudit(db, user, 'OPEN_CLASS', 'classes', rowId, null, { class_code: code });
    return true;
}
