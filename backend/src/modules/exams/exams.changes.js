import { ensure } from '../../core/errors.js';
import {id, text, dateOnly, timeOnly} from '../../utils/validation.js';

import { writeAudit } from '../audit/audit.service.js';
import {required} from '../operations/change-utils.js';
export async function handleExam({ db, user, body, patches, p, a, b, n }) {
    ensure(a && !b, 'Chỉ tạo lịch thi nháp ở biểu mẫu này.');
    const course = await required(db, 'classes', 'class_id', a.classId);
    const ass = await db.get("SELECT assessment_id FROM assessments WHERE class_id=? AND assessment_type='final'", [id(a.classId)]), room = await db.get('SELECT r.* FROM rooms r LEFT JOIN room_settings rs ON rs.room_id=r.room_id WHERE r.room_code=? AND COALESCE(rs.enabled,1)=1', [text(a.room, 'Phòng', 40)]);
    ensure(ass && room, 'Thiếu đầu điểm hoặc phòng thi đang sử dụng.');
    ensure(Number(room.capacity)>=Number(course.capacity),'Phòng thi không đủ sức chứa theo sĩ số tối đa của lớp.');
    const date = dateOnly(a.date);
    ensure(timeOnly(a.end) > timeOnly(a.start), 'Giờ thi không hợp lệ.');
    ensure(!await db.get("SELECT exam_id FROM exam_sessions WHERE status<>'cancelled' AND room_id=? AND exam_date=? AND start_time<? AND end_time>?", [room.room_id, date, a.end + ':00', a.start + ':00']), 'Phòng thi trùng lịch.', 409);
    const type = { 'Chính thức': 'regular', 'Thi lại': 'resit', 'Thi bù': 'deferred' }[a.type];
    ensure(type, 'Loại thi không hợp lệ.');
    const rowId = await db.insert('exam_sessions', { class_id: id(a.classId), assessment_id: ass.assessment_id, exam_type: type, exam_date: date, start_time: a.start + ':00', end_time: a.end + ':00', room_id: room.room_id, status: 'draft' });
    if(!await db.get('SELECT room_id FROM room_usage_history WHERE room_id=?',[room.room_id]))await db.insert('room_usage_history',{room_id:room.room_id});
    await writeAudit(db, user, 'CREATE_EXAM', 'exam_sessions', rowId);
    return true;
}
