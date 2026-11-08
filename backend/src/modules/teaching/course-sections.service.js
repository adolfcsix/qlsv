import { ensure } from '../../core/errors.js';
import { listParameters } from '../organization/organization.service.js';
import { listCourseSections } from './course-sections.repository.js';

const validStatuses = new Set(['open', 'closed', 'teaching', 'completed', 'cancelled']);

export async function getCourseSections(db, user, params) {
    ensure(['ACADEMIC_STAFF', 'LECTURER', 'STUDENT'].includes(user.role),
        'Không có quyền xem lớp học phần.', 403, 'FORBIDDEN');
    const query = listParameters(params);
    query.status = params.get('status') || null;
    ensure(!query.status || validStatuses.has(query.status), 'Trạng thái lớp không hợp lệ.');
    const semesterId = params.get('semesterId');
    ensure(!semesterId || (/^[1-9]\d*$/.test(semesterId) && Number.isSafeInteger(Number(semesterId))),
        'Học kỳ không hợp lệ.');
    query.semesterId = semesterId ? Number(semesterId) : null;
    // Sinh viên chỉ xem lớp mở thuộc chương trình của chính mình; không dựa vào tham số studentId.
    const { total, items } = await listCourseSections(db, user, query);
    return { items, pagination: { page: query.page, limit: query.limit, total,
        pages: Math.max(1, Math.ceil(total / query.limit)) } };
}

// Chi tiết dùng lại truy vấn danh sách và cùng bộ lọc phân quyền của từng vai trò.
export async function getCourseSection(db, user, classId) {
    ensure(/^[1-9]\d*$/.test(String(classId)) && Number.isSafeInteger(Number(classId)),
        'Mã lớp không hợp lệ.');
    ensure(['ACADEMIC_STAFF', 'LECTURER', 'STUDENT'].includes(user.role),
        'Không có quyền xem lớp học phần.', 403, 'FORBIDDEN');
    // Truy vấn đúng ID với cùng điều kiện quyền như danh sách, không tìm trong snapshot.
    const { items } = await listCourseSections(db, user, {
        page: 1, limit: 1, offset: 0, classId: Number(classId),
        status: null, semesterId: null, search: null
    });
    ensure(items.length, 'Không tìm thấy lớp trong phạm vi được phép xem.', 404, 'NOT_FOUND');
    return items[0];
}
