import { ensure } from '../../core/errors.js';
import { id, numeric } from '../../utils/validation.js';
import { writeAudit } from '../audit/audit.service.js';
import { classAccess } from './gradebook.service.js';
import { recalculatePublishedResult } from './results.service.js';

const sources = {
    grade: { table: 'grades', pk: 'grade_id', field: 'grade_id' },
    exam: { table: 'exam_registrations', pk: 'exam_registration_id', field: 'exam_registration_id' }
};
const stamp = () => new Date().toISOString().slice(0,19).replace('T', ' ');

async function sourceContext(db, type, sourceId) {
    const source = sources[type];
    ensure(source, 'Nguồn điểm không hợp lệ.');
    const row = await db.get(`SELECT s.*,a.max_score FROM ${source.table} s JOIN assessments a ON a.assessment_id=s.assessment_id WHERE s.${source.pk}=?`, [id(sourceId)]);
    ensure(row, 'Không tìm thấy điểm nguồn.', 404);
    const result = await db.get('SELECT r.* FROM course_results r JOIN result_components rc ON rc.result_id=r.result_id WHERE r.enrollment_id=? AND rc.assessment_id=? AND rc.' + source.field + '=? AND r.is_published=1', [row.enrollment_id, row.assessment_id, id(sourceId)]);
    ensure(result, 'Điểm này chưa thuộc kết quả đã công bố hoặc không phải nguồn điểm được công nhận.', 409);
    return { row, result, source };
}

export async function requestGradeChange(db, user, body) {
    return db.tx(async () => {
        ensure(body && typeof body === 'object', 'Thiếu nội dung đề nghị.');
        const { type, sourceId, proposedScore, reason } = body;
        const { row, source } = await sourceContext(db, type, sourceId);
        await classAccess(db, user, row.class_id);
        ensure(typeof reason === 'string' && reason.trim().length >= 10 && reason.trim().length <= 1000, 'Lý do cần 10–1000 ký tự.');
        ensure(typeof proposedScore === 'number' && Number.isFinite(proposedScore), 'Điểm đề nghị phải là số.');
        const score = numeric(proposedScore, 0, Number(row.max_score), 'Điểm đề nghị');
        ensure(row.score != null && Number(row.score) !== score, 'Điểm mới phải khác điểm nguồn hiện tại.');
        const pending = await db.get(`SELECT change_request_id FROM grade_change_requests WHERE ${source.field}=? AND status IN ('submitted','approved')`, [id(sourceId)]);
        ensure(!pending, 'Điểm này đã có đề nghị đang chờ xử lý.', 409);
        const values = { grade_id: type === 'grade' ? row.grade_id : null, exam_registration_id: type === 'exam' ? row.exam_registration_id : null, old_score: row.score, proposed_score: score, reason: reason.trim(), requested_by: user.user_id, status: 'submitted' };
        const requestId = await db.insert('grade_change_requests', values);
        await writeAudit(db, user, 'REQUEST_GRADE_CHANGE', 'grade_change_requests', requestId, null, { ...values, reason: reason.trim() }, reason.trim());
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return { id: String(requestId), status: 'submitted' };
    });
}

export async function listGradeChanges(db, user, params) {
    ensure(['ACADEMIC_STAFF', 'LECTURER'].includes(user.role), 'Không được xem đề nghị sửa điểm.', 403);
    const classId = params.get('classId');
    if (classId) await classAccess(db, user, classId);
    const status = params.get('status');
    if (status) ensure(['submitted','approved','rejected','applied'].includes(status), 'Trạng thái đề nghị không hợp lệ.');
    const page = Math.max(1, Math.min(99999, Math.floor(Number(params.get('page')) || 1)));
    const limit = 30;
    const where = ['1=1'], values = [];
    if (classId) { where.push('e.class_id=?'); values.push(id(classId)); }
    if (status) { where.push('gcr.status=?'); values.push(status); }
    if (user.role === 'LECTURER') { where.push('l.user_id=?'); values.push(user.user_id); }
    const joins = `FROM grade_change_requests gcr LEFT JOIN grades g ON g.grade_id=gcr.grade_id LEFT JOIN exam_registrations er ON er.exam_registration_id=gcr.exam_registration_id JOIN enrollments e ON e.enrollment_id=COALESCE(g.enrollment_id,er.enrollment_id) JOIN students s ON s.student_id=e.student_id JOIN classes c ON c.class_id=e.class_id LEFT JOIN lecturers l ON l.lecturer_id=c.lecturer_id JOIN assessments a ON a.assessment_id=COALESCE(g.assessment_id,er.assessment_id)`;
    const condition = where.join(' AND ');
    const count = await db.get(`SELECT COUNT(*) AS n ${joins} WHERE ${condition}`, values);
    const rows = await db.all(`SELECT gcr.*,e.class_id,s.student_code,s.full_name,c.class_code,a.name AS assessment_name,a.max_score ${joins} WHERE ${condition} ORDER BY gcr.requested_at DESC,gcr.change_request_id DESC LIMIT ? OFFSET ?`, [...values, limit, (page-1)*limit]);
    return { items: rows.map(r => ({ id: String(r.change_request_id), type: r.grade_id ? 'grade' : 'exam', sourceId: String(r.grade_id || r.exam_registration_id), studentCode: r.student_code, studentName: r.full_name, classId: String(r.class_id), classCode: r.class_code, assessment: r.assessment_name, oldScore: r.old_score == null ? null : Number(r.old_score), proposedScore: Number(r.proposed_score), maxScore: Number(r.max_score), reason: r.reason, status: r.status, requestedBy: String(r.requested_by), approvedBy: r.approved_by == null ? null : String(r.approved_by), requestedAt: r.requested_at, approvedAt: r.approved_at })) , pagination: { page, limit, total: Number(count.n), pages: Math.max(1, Math.ceil(Number(count.n)/limit)) } };
}

export async function reviewGradeChange(db, user, requestId, body) {
    return db.tx(async () => {
        ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo được duyệt sửa điểm.', 403);
        ensure(body && typeof body === 'object', 'Thiếu quyết định duyệt.');
        ensure(['approve','reject'].includes(body.decision), 'Quyết định không hợp lệ.');
        ensure(typeof body.reason === 'string' && body.reason.trim().length >= 10 && body.reason.trim().length <= 1000, 'Cần lý do duyệt hoặc từ chối (10–1000 ký tự).');
        const request = await db.get('SELECT * FROM grade_change_requests WHERE change_request_id=?', [id(requestId)]);
        ensure(request, 'Không tìm thấy đề nghị.', 404);
        ensure(request.status === 'submitted', 'Đề nghị đã được xử lý.', 409);
        ensure(Number(request.requested_by) !== Number(user.user_id), 'Không được tự phê duyệt đề nghị của mình.', 403);
        const sourceType = request.grade_id ? 'grade' : 'exam';
        const sourceId = request.grade_id || request.exam_registration_id;
        const { row, source } = await sourceContext(db, sourceType, sourceId);
        ensure(row.score != null && Number(row.score) === Number(request.old_score), 'Điểm đã thay đổi. Hãy lập đề nghị mới.', 409);
        let next = body.decision === 'approve' ? 'applied' : 'rejected';
        if (body.decision === 'approve') {
            // Until recalculation of approved GPA/warnings is implemented, do not alter an official summary.
            const summaries = await db.get("SELECT COUNT(*) AS n FROM semester_summaries ss JOIN enrollments e ON e.student_id=ss.student_id WHERE e.enrollment_id=? AND ss.status='approved'", [row.enrollment_id]);
            ensure(Number(summaries.n) === 0, 'Đã có tổng kết học kỳ được duyệt: phải lập quy trình tổng kết lại trước khi áp dụng sửa điểm.', 409, 'APPROVED_SUMMARY_EXISTS');
            await db.update(source.table, source.pk, sourceId, { score: Number(request.proposed_score) });
            await recalculatePublishedResult(db, user, row.enrollment_id, { requestId: request.change_request_id, reason: body.reason.trim() });
        }
        await db.update('grade_change_requests', 'change_request_id', request.change_request_id, { status: next, approved_by: user.user_id, approved_at: stamp() });
        await writeAudit(db, user, body.decision === 'approve' ? 'APPLY_GRADE_CHANGE' : 'REJECT_GRADE_CHANGE', 'grade_change_requests', request.change_request_id, { status: request.status, oldScore: request.old_score }, { status: next, proposedScore: request.proposed_score }, body.reason.trim());
        if (body.decision === 'reject') await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return { id: String(request.change_request_id), status: next };
    });
}
