import { setStudentPhoto, validatePhoto } from './student-photo.service.js';
import { ensure } from '../../core/errors.js';
import {id, text, dateOnly, enumeration} from '../../utils/validation.js';

import { writeAudit } from '../audit/audit.service.js';
import {changed, required, duplicate, isoNow, statuses} from '../operations/change-utils.js';
export async function handleStudents({ db, user, body, patches, p, a, b, n }) {
    ensure(a, 'Không xóa hồ sơ sinh viên.');
    let old;
    if (b) {
        old = await required(db, 'students', 'student_id', n);
        changed(b, a, ['name', 'dob', 'gender', 'email', 'phone', 'address', 'status', 'groupId', 'photoData']);
        ensure(a.code === old.student_code && a.admissionDate === old.admission_date, 'Không sửa mã sinh viên hoặc ngày nhập học bằng biểu mẫu này.');
    }
    const group = await required(db, 'student_groups', 'student_group_id', a.groupId);
    if (a.photoData !== undefined) validatePhoto(a.photoData);
    if (!['withdrawn','graduated'].includes(a.status || 'studying') && (!old || old.student_group_id !== group.student_group_id || ['withdrawn','graduated'].includes(old.status))) {
        const setting = await db.get('SELECT capacity FROM group_settings WHERE student_group_id=?', [group.student_group_id]);
        const used = await db.get("SELECT COUNT(*) AS n FROM students WHERE student_group_id=? AND status NOT IN ('withdrawn','graduated')", [group.student_group_id]);
        ensure(Number(used.n) < Number(setting?.capacity ?? 50), 'Lớp hành chính đã đủ sĩ số tối đa.', 409, 'GROUP_FULL');
    }
    const dob = dateOnly(a.dob), admission = dateOnly(a.admissionDate);
    ensure(dob < admission, 'Ngày sinh phải trước ngày nhập học.');
    const values = { student_code: text(a.code, 'Mã sinh viên', 30), full_name: text(a.name, 'Họ tên', 200), date_of_birth: dob, gender: text(a.gender || '', 'Giới tính', 30, false), email: text(a.email || '', 'Email', 255, false), phone: text(a.phone || '', 'Điện thoại', 30, false), current_address: text(a.address || '', 'Địa chỉ', 500, false), admission_date: admission, student_group_id: group.student_group_id, status: enumeration(a.status || 'studying', statuses) };
    await duplicate(db, 'students', 'student_code', values.student_code, 'student_id', n);
    ensure(values.status !== 'graduated' || old?.status === 'graduated', 'Xét tốt nghiệp cần quy trình duyệt riêng.');
    if (!old)
        ensure(values.status === 'studying', 'Hồ sơ mới phải ở trạng thái đang học.');
    if (old && (values.status !== old.status || values.student_group_id !== old.student_group_id)) {
        const h = patches.find(x => x.table === 'history' && !x.before && String(x.after?.studentId) === String(n))?.after;
        ensure(h, 'Biến động học vụ cần số quyết định và căn cứ.');
        const oldGroup = await required(db, 'student_groups', 'student_group_id', old.student_group_id);
        ensure(oldGroup.curriculum_id === group.curriculum_id, 'Chuyển chương trình cần quy trình công nhận kết quả riêng.');
        const effective = dateOnly(h.date);
        ensure(effective <= isoNow().slice(0, 10), 'Chưa hỗ trợ quyết định có hiệu lực trong tương lai.');
        await db.insert('student_status_history', { student_id: n, effective_date: effective, old_status: old.status, new_status: values.status, old_group_id: old.student_group_id, new_group_id: group.student_group_id, decision_number: text(h.decision, 'Số quyết định', 100), reason: text(h.reason, 'Căn cứ', 4000), approved_by: user.user_id });
    }
    const rowId = n || await db.insert('students', values);
    if (n)
        await db.update('students', 'student_id', n, values);
    if (a.photoData !== undefined) await setStudentPhoto(db, user, rowId, a.photoData);
    await writeAudit(db, user, n ? 'UPDATE_STUDENT' : 'CREATE_STUDENT', 'students', rowId, old || null, { student_code: values.student_code, full_name: values.full_name, status: values.status });
    return true;
}
export async function handleContacts({ db, user, body, patches, p, a, b, n }) {
    ensure(a && !b, 'Chỉ thêm liên hệ ở phiên bản này.');
    await required(db, 'students', 'student_id', a.studentId);
    const rowId = await db.insert('student_contacts', { student_id: id(a.studentId), full_name: text(a.name, 'Họ tên', 200), relationship: text(a.relationship, 'Quan hệ', 60), phone: text(a.phone || '', 'Điện thoại', 30, false), address: text(a.address || '', 'Địa chỉ', 500, false), is_emergency: a.emergency ? 1 : 0 });
    await writeAudit(db, user, 'CREATE_CONTACT', 'student_contacts', rowId);
    return true;
}
