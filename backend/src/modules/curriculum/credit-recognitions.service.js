import { ensure } from '../../core/errors.js';
import { id, text, dateOnly } from '../../utils/validation.js';
import { academicMutation, auditRevision } from '../operations/revision.js';

const timestamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

async function studentFor(db, user, studentId) {
    ensure(['ACADEMIC_STAFF','STUDENT'].includes(user.role), 'Không có quyền tra cứu công nhận học phần.', 403);
    const student = await db.get(`SELECT s.student_id AS id, s.student_code AS code, s.full_name AS name,
        g.curriculum_id AS curriculumId FROM students s
        JOIN student_groups g ON g.student_group_id=s.student_group_id
        WHERE ${user.role === 'STUDENT' ? 's.user_id=?' : 's.student_id=?'}`,
        [user.role === 'STUDENT' ? user.user_id : id(studentId)]);
    ensure(student, 'Không tìm thấy sinh viên thuộc phạm vi tài khoản.', 404);
    return student;
}

export async function listRecognitions(db, user, studentId) {
    const student = await studentFor(db, user, studentId);
    const records = await db.all(`SELECT r.recognition_id AS id, r.target_assignment_id AS targetAssignmentId,
        r.source_result_id AS sourceResultId, r.decision_number AS decisionNumber,
        r.decision_date AS decisionDate, r.explanation, r.approved_at AS approvedAt,
        r.revoked_at AS revokedAt, r.revoke_reason AS revokeReason,
        target.subject_code AS targetCode, source.subject_code AS sourceCode
        FROM credit_recognitions r
        JOIN curriculum_subjects cs ON cs.curriculum_subject_id=r.target_assignment_id
        JOIN subjects target ON target.subject_id=cs.subject_id
        JOIN course_results cr ON cr.result_id=r.source_result_id
        JOIN enrollments e ON e.enrollment_id=cr.enrollment_id
        JOIN classes cl ON cl.class_id=e.class_id JOIN subjects source ON source.subject_id=cl.subject_id
        WHERE r.student_id=? ORDER BY r.recognition_id DESC LIMIT 100`, [student.id]);
    return { student, records };
}

export async function recognitionCandidates(db, user, studentId) {
    ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo được lập hồ sơ công nhận.', 403);
    const student = await studentFor(db, user, studentId);
    const targets = await db.all(`SELECT cs.curriculum_subject_id AS id, s.subject_code AS code,
        s.name, s.credits FROM curriculum_subjects cs JOIN subjects s ON s.subject_id=cs.subject_id
        WHERE cs.curriculum_id=? ORDER BY s.subject_code`, [student.curriculumId]);
    const sources = await db.all(`SELECT cr.result_id AS id, s.subject_code AS code, s.name,
        cr.credits_snapshot AS credits FROM course_results cr
        JOIN enrollments e ON e.enrollment_id=cr.enrollment_id
        JOIN classes c ON c.class_id=e.class_id JOIN subjects s ON s.subject_id=c.subject_id
        WHERE e.student_id=? AND e.status NOT IN ('cancelled','withdrawn')
        AND cr.is_published=1 AND cr.outcome='passed' ORDER BY cr.result_id DESC`, [student.id]);
    return { student, targets, sources };
}

export async function approveRecognition(db, user, input) {
    return academicMutation(db, user, input.revision, async () => {
        const student = await studentFor(db, user, input.studentId);
        const targetId = id(input.targetAssignmentId), sourceId = id(input.sourceResultId);
        const decisionNumber = text(input.decisionNumber, 'Số quyết định', 100);
        const decisionDate = dateOnly(input.decisionDate);
        const explanation = text(input.explanation, 'Căn cứ công nhận tương đương', 500);
        const target = await db.get(`SELECT cs.curriculum_subject_id, cs.subject_id,
            cs.curriculum_id, s.credits FROM curriculum_subjects cs JOIN subjects s ON s.subject_id=cs.subject_id
            WHERE cs.curriculum_subject_id=? AND cs.curriculum_id=?`, [targetId, student.curriculumId]);
        ensure(target, 'Môn được công nhận phải thuộc chương trình hiện tại của sinh viên.', 422);
        const source = await db.get(`SELECT cr.result_id, cr.outcome, cr.is_published, c.subject_id,
            e.student_id FROM course_results cr JOIN enrollments e ON e.enrollment_id=cr.enrollment_id
            JOIN classes c ON c.class_id=e.class_id
            WHERE cr.result_id=? AND e.status NOT IN ('cancelled','withdrawn')`, [sourceId]);
        ensure(source && source.student_id === student.id && source.is_published == 1 && source.outcome === 'passed',
            'Kết quả nguồn phải là học phần đã đạt và công bố của chính sinh viên.', 422);
        ensure(Number(source.subject_id) !== Number(target.subject_id),
            'Hai môn giống nhau không cần quyết định tương đương.', 422);
        // A source course which is already in the student's current curriculum
        // cannot be counted a second time under a different target subject.
        const sourceAssigned = await db.get(`SELECT 1 AS present FROM curriculum_subjects
            WHERE curriculum_id=? AND subject_id=? LIMIT 1`, [student.curriculumId, source.subject_id]);
        ensure(!sourceAssigned,
            'Học phần nguồn đã thuộc chương trình hiện tại; không được công nhận để cộng tín chỉ hai lần.', 409);
        const completedReview = await db.get(`SELECT 1 AS used FROM graduation_reviews
            WHERE student_id=? AND status='approved' LIMIT 1`, [student.id]);
        ensure(!completedReview, 'Hồ sơ xét tốt nghiệp đã duyệt; cần rà soát quyết định trước khi công nhận mới.', 409);
        const targetPassed = await db.get(`SELECT 1 AS used FROM course_results cr
            JOIN enrollments e ON e.enrollment_id=cr.enrollment_id JOIN classes c ON c.class_id=e.class_id
            WHERE e.student_id=? AND c.subject_id=? AND cr.is_published=1 AND cr.outcome='passed' LIMIT 1`,
            [student.id, target.subject_id]);
        ensure(!targetPassed, 'Sinh viên đã đạt trực tiếp học phần đích.', 409);
        const duplicate = await db.get(`SELECT recognition_id FROM credit_recognitions WHERE student_id=?
            AND revoked_at IS NULL AND (target_assignment_id=? OR source_result_id=? OR decision_number=?) LIMIT 1`,
            [student.id, targetId, sourceId, decisionNumber]);
        ensure(!duplicate, 'Nguồn điểm, môn đích hoặc số quyết định đã được công nhận đang hiệu lực.', 409);
        const inserted = await db.insert('credit_recognitions', { student_id: student.id,
            target_assignment_id: targetId, source_result_id: sourceId, decision_number: decisionNumber,
            decision_date: decisionDate, explanation, approved_by:user.user_id,
            approved_at:timestamp(), revoked_by:null, revoked_at:null, revoke_reason:null });
        await auditRevision(db, user, 'APPROVE_EQUIVALENCY', 'credit_recognitions', inserted, null,
            {studentId:student.id, targetAssignmentId:targetId, sourceResultId:sourceId, decisionNumber}, explanation);
        return { id: inserted, status:'approved' };
    });
}

export async function revokeRecognition(db, user, recognitionId, input) {
    return academicMutation(db, user, input.revision, async () => {
        const row = await db.get('SELECT * FROM credit_recognitions WHERE recognition_id=?', [id(recognitionId)]);
        ensure(row, 'Không tìm thấy quyết định tương đương.', 404);
        ensure(!row.revoked_at, 'Quyết định đã được thu hồi.', 409);
        const note = text(input.reason, 'Lý do thu hồi', 500);
        const approvedReview = await db.get(`SELECT 1 AS used FROM graduation_reviews
            WHERE student_id=? AND status='approved' LIMIT 1`, [row.student_id]);
        ensure(!approvedReview, 'Đã có hồ sơ xét tốt nghiệp được duyệt; cần rà lại hồ sơ trước khi thu hồi.', 409);
        await db.update('credit_recognitions', 'recognition_id', row.recognition_id,
            { revoked_by:user.user_id, revoked_at:timestamp(), revoke_reason:note });
        await auditRevision(db, user, 'REVOKE_EQUIVALENCY', 'credit_recognitions', row.recognition_id,
            {revokedAt:null}, {revoked:true}, note);
        return { id: row.recognition_id, status:'revoked' };
    });
}
