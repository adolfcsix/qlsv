import { ensure } from '../../core/errors.js';
import { id, text } from '../../utils/validation.js';
import { academicMutation, auditRevision } from '../operations/revision.js';
import { progress } from '../curriculum/curriculum-progress.service.js';

const timestamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const today = () => new Date().toISOString().slice(0, 10);

// This is a review of eligibility, not a graduation diploma or a change of student.status.
function academicEvidence(result) {
    return JSON.stringify({ studentId: Number(result.student.id), curriculumId: Number(result.student.curriculumId),
        requiredCredits:result.requiredCredits, earnedCredits:result.earnedCredits,
        readyForManualReview:result.readyForManualReview,
        subjects:result.subjects.map(s => [s.id,s.learningStatus,s.recognizedResultId,s.recognizedCredits,s.recognitionId || null]),
        groups:result.electiveGroups.map(g => [g.id,g.remainingCredits]) });
}

async function studentScope(db, user, requestedId) {
    ensure(['ACADEMIC_STAFF','STUDENT'].includes(user.role), 'Không có quyền xem hồ sơ xét tốt nghiệp.', 403);
    const row = await db.get(`SELECT s.student_id AS id, g.curriculum_id AS curriculumId
        FROM students s JOIN student_groups g ON g.student_group_id=s.student_group_id
        WHERE ${user.role === 'STUDENT' ? 's.user_id=?' : 's.student_id=?'}`,
        [user.role === 'STUDENT' ? user.user_id : id(requestedId)]);
    ensure(row, 'Không tìm thấy sinh viên trong phạm vi được phép.', 404);
    return row;
}

export async function listGraduationReviews(db, user, studentId) {
    const student = await studentScope(db, user, studentId);
    const records = await db.all(`SELECT review_id AS id, student_id AS studentId, curriculum_id AS curriculumId,
        status, created_at AS createdAt, approved_at AS approvedAt, review_note AS reviewNote,
        decision_id AS decisionId, academic_snapshot AS academicSnapshot, external_checks AS externalChecks
        FROM graduation_reviews WHERE student_id=? ${user.role === 'STUDENT' ? "AND status='approved'" : ''}
        ORDER BY review_id DESC LIMIT 60`, [student.id]);
    return { student, records: records.map(row => ({ ...row,
        academicSnapshot: JSON.parse(row.academicSnapshot),
        externalChecks: row.externalChecks ? JSON.parse(row.externalChecks) : null })) };
}

export async function draftGraduationReview(db, user, input) {
    return academicMutation(db, user, input.revision, async () => {
        const studentId = id(input.studentId);
        const current = await progress(db, user, studentId);
        ensure(current.readyForManualReview, 'Tiến độ học phần chưa đạt điều kiện để mở hồ sơ xét tốt nghiệp.', 409);
        const exists = await db.get(`SELECT review_id FROM graduation_reviews WHERE student_id=?
            AND status IN ('draft','approved') LIMIT 1`, [studentId]);
        ensure(!exists, 'Sinh viên đã có hồ sơ xét tốt nghiệp đang xử lý hoặc đã duyệt.', 409);
        const note = text(input.note, 'Ghi chú mở hồ sơ', 500);
        const snapshot = academicEvidence(current);
        const reviewId = await db.insert('graduation_reviews', {
            student_id:studentId, curriculum_id:current.student.curriculumId,
            status:'draft', academic_snapshot:snapshot, external_checks:null, review_note:note,
            created_by:user.user_id, created_at:timestamp(), approved_by:null, approved_at:null, decision_id:null
        });
        await auditRevision(db, user, 'DRAFT_GRADUATION_REVIEW', 'graduation_reviews', reviewId,
            null, {studentId, curriculumId:current.student.curriculumId, status:'draft'}, note);
        return {id:reviewId, status:'draft'};
    });
}

export async function completeGraduationReview(db, user, reviewId, input, rejected = false) {
    return academicMutation(db, user, input.revision, async () => {
        const review = await db.get('SELECT * FROM graduation_reviews WHERE review_id=?', [id(reviewId)]);
        ensure(review, 'Không tìm thấy hồ sơ xét tốt nghiệp.', 404);
        ensure(review.status === 'draft', 'Hồ sơ đã được xử lý; không thể duyệt lại.', 409);
        const note = text(input.note, 'Lý do hoặc kết luận xử lý', 1000);
        if (rejected) {
            await db.update('graduation_reviews','review_id',review.review_id,
                {status:'rejected',review_note:note,approved_by:user.user_id,approved_at:timestamp()});
            await auditRevision(db,user,'REJECT_GRADUATION_REVIEW','graduation_reviews',review.review_id,
                {status:'draft'},{status:'rejected'},note);
            return {id:review.review_id,status:'rejected'};
        }
        const checks = input.externalChecks;
        ensure(checks && typeof checks === 'object' && !Array.isArray(checks) &&
            ['conduct','discipline','certificates','otherRequirements'].every(key => checks[key] === true),
            'Cần xác nhận đầy đủ điều kiện rèn luyện, kỷ luật, chứng chỉ và điều kiện bổ sung.', 422);
        const evidence = text(input.evidence, 'Căn cứ đối chiếu điều kiện ngoài chương trình', 1000);
        const decisionNumber = text(input.decisionNumber, 'Số quyết định xét tốt nghiệp', 100);
        const current = await progress(db,user,review.student_id);
        ensure(current.readyForManualReview && academicEvidence(current) === review.academic_snapshot,
            'Kết quả học tập đã thay đổi. Cần lập lại hồ sơ để rà soát.', 409, 'STALE_ACADEMIC_REVIEW');
        const summary = await db.get(`SELECT 1 AS ok FROM semester_summaries
            WHERE student_id=? AND status='approved' AND is_current=1 LIMIT 1`, [review.student_id]);
        ensure(summary, 'Cần có tổng kết học kỳ được duyệt trước khi xét tốt nghiệp.', 409);
        const decision = await db.insert('student_decisions', { student_id:review.student_id, semester_id:null,
            decision_type:'graduation_review', decision_number:decisionNumber,
            decision_date:today(), content:note+' | Đối chiếu: '+evidence, approved_by:user.user_id });
        await db.update('graduation_reviews','review_id',review.review_id,{
            status:'approved',review_note:note,
            external_checks:JSON.stringify({...checks,evidence}),approved_by:user.user_id,
            approved_at:timestamp(),decision_id:decision
        });
        await auditRevision(db,user,'APPROVE_GRADUATION_REVIEW','graduation_reviews',review.review_id,
            {status:'draft'},{status:'approved',decisionId:decision},note);
        return {id:review.review_id,status:'approved',decisionId:decision,
            message:'Đã duyệt hồ sơ xét; chưa tự động chuyển trạng thái sinh viên thành tốt nghiệp.'};
    });
}
