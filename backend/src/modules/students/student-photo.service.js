import { ensure } from '../../core/errors.js';
import { id } from '../../utils/validation.js';

export function validatePhoto(value) {
    if (value === '') return '';
    ensure(typeof value === 'string', 'Ảnh hồ sơ không hợp lệ.');
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    ensure(match && value.length <= 112000, 'Ảnh phải là JPEG, PNG hoặc WebP, tối đa 80 KB sau xử lý.');
    const bytes = Buffer.from(match[2], 'base64');
    ensure(bytes.length >= 12 && bytes.length <= 81920 && bytes.toString('base64') === match[2], 'Nội dung ảnh không hợp lệ.');
    const valid = match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
        match[1] === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) :
        bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
    ensure(valid, 'Nội dung ảnh không khớp định dạng.');
    return value;
}
export async function setStudentPhoto(db, user, studentId, value) {
    ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo được đổi ảnh hồ sơ.', 403);
    validatePhoto(value);
    if (!value) return db.run('DELETE FROM student_photos WHERE student_id=?', [studentId]);
    const old = await db.get('SELECT version FROM student_photos WHERE student_id=?', [studentId]);
    if (old) await db.update('student_photos','student_id',studentId,{data_url:value,version:old.version+1,updated_by:user.user_id});
    else await db.insert('student_photos',{student_id:studentId,data_url:value,version:1,updated_by:user.user_id});
}
export async function getStudentPhoto(db, user, studentId) {
    const student = await db.get('SELECT * FROM students WHERE student_id=?',[id(studentId)]);
    ensure(student,'Không tìm thấy sinh viên.',404);
    let permitted = user.role === 'ACADEMIC_STAFF' || user.role === 'ADMIN' || user.role === 'STUDENT' && student.user_id === user.user_id;
    if (user.role === 'LECTURER') permitted = Boolean(await db.get(`SELECT l.lecturer_id FROM lecturers l
        WHERE l.user_id=? AND (EXISTS(SELECT 1 FROM student_groups g WHERE g.student_group_id=? AND g.advisor_lecturer_id=l.lecturer_id)
        OR EXISTS(SELECT 1 FROM enrollments e JOIN classes c ON c.class_id=e.class_id WHERE e.student_id=? AND c.lecturer_id=l.lecturer_id))`,[user.user_id,student.student_group_id,student.student_id]));
    ensure(permitted,'Không được xem ảnh hồ sơ này.',403);
    const photo=await db.get('SELECT data_url FROM student_photos WHERE student_id=?',[student.student_id]);
    ensure(photo,'Hồ sơ chưa có ảnh.',404);
    const [,mime,data]=/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(photo.data_url);
    return {mime,bytes:Buffer.from(data,'base64')};
}
