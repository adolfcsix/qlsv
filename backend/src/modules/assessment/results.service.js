import { ensure } from '../../core/errors.js';
import { id } from '../../utils/validation.js';
import { writeAudit } from '../audit/audit.service.js';
export async function publishResult(db, user, enrollmentId) { return db.tx(() => publishWithin(db, user, enrollmentId)); }
// Reuse the identical policy calculation after a formally approved correction. Caller owns transaction.
export async function recalculatePublishedResult(db, user, enrollmentId, correction) {
    ensure(correction?.requestId && correction?.reason, 'Thiếu căn cứ duyệt sửa điểm.');
    return publishWithin(db, user, enrollmentId, correction);
}
export async function publishClass(db, user, classId) {
    return db.tx(async () => {
        ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo công bố kết quả.', 403);
        const rows = await db.all("SELECT e.enrollment_id FROM enrollments e WHERE e.class_id=? AND e.status NOT IN ('cancelled','withdrawn') AND NOT EXISTS (SELECT 1 FROM course_results r WHERE r.enrollment_id=e.enrollment_id AND r.is_published=1) ORDER BY e.enrollment_id", [id(classId)]);
        ensure(rows.length, 'Không còn kết quả cần công bố.', 409);
        const results = [];
        for (const row of rows)
            results.push(await publishWithin(db, user, row.enrollment_id));
        return { count: results.length, demo: results.some(r => r.demo), results };
    });
}
async function publishWithin(db, user, enrollmentId, correction = null) {
    ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo công bố kết quả.', 403);
    const en = await db.get('SELECT e.*,c.subject_id,su.credits,s.student_group_id FROM enrollments e JOIN classes c ON c.class_id=e.class_id JOIN subjects su ON su.subject_id=c.subject_id JOIN students s ON s.student_id=e.student_id WHERE e.enrollment_id=?', [id(enrollmentId)]);
    ensure(en, 'Không tìm thấy lần học.', 404);
    ensure(!['cancelled', 'withdrawn'].includes(en.status), 'Lần học đã hủy hoặc rút, không được công bố kết quả.', 409);
    const policy = await db.get('SELECT ap.* FROM academic_policies ap JOIN curricula p ON p.policy_id=ap.policy_id JOIN student_groups g ON g.curriculum_id=p.curriculum_id WHERE g.student_group_id=?', [en.student_group_id]);
    ensure(policy?.approved_by, 'Quy chế chưa được duyệt.');
    const rules = typeof policy.rules === 'string' ? JSON.parse(policy.rules) : policy.rules;
    ensure(Array.isArray(rules.gradeBands) && Number.isFinite(rules.passScore), 'Chưa cấu hình đủ công thức quy đổi.');
    ensure(rules.demo || process.env.ALLOW_OFFICIAL_PUBLICATION === '1', 'Chưa bật công bố chính thức theo quy chế đã xác nhận.', 409, 'POLICY_NOT_CONFIRMED');
    const published = await db.get('SELECT result_id FROM course_results WHERE enrollment_id=? AND is_published=1', [en.enrollment_id]);
    ensure(correction ? published : !published, correction ? 'Chỉ điều chỉnh kết quả đã công bố.' : 'Kết quả đã công bố. Cần đề nghị sửa điểm.', 409);
    const assessments = await db.all('SELECT * FROM assessments WHERE class_id=?', [en.class_id]);
    ensure(assessments.length && Math.abs(assessments.reduce((s, a) => s + Number(a.weight), 0) - 100) < .0001, 'Tổng trọng số phải bằng 100%.');
    let total = 0;
    const components = [];
    for (const a of assessments) {
        const exam = await db.get('SELECT exam_id FROM exam_sessions WHERE assessment_id=?', [a.assessment_id]);
        let grade = null, attempt = null;
        if (exam) {
            const eligibility = await db.get("SELECT eligibility_id FROM exam_eligibility WHERE enrollment_id=? AND assessment_id=? AND conclusion='eligible'", [en.enrollment_id, a.assessment_id]);
            ensure(eligibility, 'Chưa xác nhận đủ điều kiện dự thi.');
            ensure(rules.examSelection === 'latest_attended', 'Chưa xác nhận quy tắc chọn lần thi.');
            attempt = await db.get("SELECT * FROM exam_registrations WHERE enrollment_id=? AND assessment_id=? AND status='attended' AND score IS NOT NULL ORDER BY attempt_no DESC LIMIT 1", [en.enrollment_id, a.assessment_id]);
        }
        else
            grade = await db.get('SELECT * FROM grades WHERE enrollment_id=? AND assessment_id=?', [en.enrollment_id, a.assessment_id]);
        const score = attempt?.score ?? grade?.score;
        ensure(score !== null && score !== undefined && Number(score) >= 0 && Number(score) <= Number(a.max_score), 'Thiếu điểm hoặc điểm vượt thang tối đa.');
        total += Number(score) / Number(a.max_score) * 10 * Number(a.weight) / 100;
        components.push({ assessment_id: a.assessment_id, grade_id: grade?.grade_id || null, exam_registration_id: attempt?.exam_registration_id || null, score_snapshot: Number(score), weight_snapshot: Number(a.weight), max_score_snapshot: Number(a.max_score) });
    }
    const decimals = Number.isInteger(rules.roundDecimals) ? rules.roundDecimals : 2;
    ensure(decimals >= 0 && decimals <= 2, 'Số chữ số làm tròn chưa hợp lệ.');
    total = Number(total.toFixed(decimals));
    const band = [...rules.gradeBands].sort((a, b) => b.min - a.min).find(b => total >= b.min);
    ensure(band && Number.isFinite(band.gpa), 'Không tìm thấy mức quy đổi.');
    const values = { enrollment_id: en.enrollment_id, policy_id: policy.policy_id, credits_snapshot: en.credits, total_score: total, grade_point: band.gpa, letter_grade: band.letter, outcome: total >= rules.passScore ? 'passed' : 'failed', is_published: 1, finalized_by: user.user_id, finalized_at: new Date().toISOString().slice(0, 19).replace('T', ' ') };
    const old = await db.get('SELECT * FROM course_results WHERE enrollment_id=?', [en.enrollment_id]);
    let resultId;
    if (old) {
        await db.update('course_results', 'result_id', old.result_id, values);
        resultId = old.result_id;
        await db.run('DELETE FROM result_components WHERE result_id=?', [resultId]);
    }
    else
        resultId = await db.insert('course_results', values);
    for (const component of components)
        await db.insert('result_components', { ...component, result_id: resultId, enrollment_id: en.enrollment_id });
    await db.update('enrollments', 'enrollment_id', en.enrollment_id, { status: 'completed' });
    await writeAudit(db, user, correction ? 'RECALCULATE_RESULT' : 'PUBLISH_RESULT', 'course_results', resultId, old || null, { total_score: total, policy: policy.code, demo: !!rules.demo, correctionRequestId: correction?.requestId || null }, correction?.reason || 'Công bố kết quả theo quy chế');
    await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
    return { resultId, total, policy: policy.code, demo: !!rules.demo };
}
export async function examAttempts(db, user, enrollmentId) {
    ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo nhập kết quả thi.', 403);
    return db.all("SELECT er.exam_registration_id AS id,er.enrollment_id AS enrollmentId,er.attempt_no AS attempt,er.status,er.score,er.candidate_number AS candidate,es.exam_date AS date,es.exam_type AS type,a.max_score AS maxScore,er.reason FROM exam_registrations er JOIN exam_sessions es ON es.exam_id=er.exam_id JOIN assessments a ON a.assessment_id=er.assessment_id WHERE er.enrollment_id=? ORDER BY er.attempt_no DESC", [id(enrollmentId)]);
}
export async function saveExamScore(db, user, attemptId, body) {
    return db.tx(async () => {
        ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo nhập kết quả thi.', 403);
        const row = await db.get('SELECT er.*,a.max_score,es.status AS exam_status FROM exam_registrations er JOIN assessments a ON a.assessment_id=er.assessment_id JOIN exam_sessions es ON es.exam_id=er.exam_id WHERE er.exam_registration_id=?', [id(attemptId)]);
        ensure(row, 'Không tìm thấy lần dự thi.', 404);
        const enrollment = await db.get('SELECT status FROM enrollments WHERE enrollment_id=?', [row.enrollment_id]);
        ensure(enrollment && !['cancelled', 'withdrawn'].includes(enrollment.status),
            'Lần học đã hủy hoặc rút, không được nhập điểm thi.', 409);
        ensure(['published', 'completed'].includes(row.exam_status), 'Đợt thi chưa được công bố hoặc đã hủy.', 409);
        ensure(!await db.get('SELECT result_id FROM course_results WHERE enrollment_id=? AND is_published=1', [row.enrollment_id]), 'Kết quả đã công bố. Cần đề nghị sửa điểm.', 409);
        ensure(await db.get("SELECT eligibility_id FROM exam_eligibility WHERE enrollment_id=? AND assessment_id=? AND conclusion='eligible'", [row.enrollment_id, row.assessment_id]), 'Chưa xác nhận đủ điều kiện dự thi.', 409);
        ensure(['registered', 'attended', 'absent'].includes(body.status), 'Chỉ cập nhật chưa có kết quả, dự thi hoặc vắng thi.');
        ensure(body.status === 'attended' ? typeof body.score === 'number' && Number.isFinite(body.score) && body.score >= 0 && body.score <= Number(row.max_score) : body.score === null, 'Điểm dự thi phải đúng thang; chưa thi hoặc vắng thi cần để trống.');
        ensure(typeof body.reason === 'string' && body.reason.trim().length > 0 && body.reason.length <= 500, 'Cần căn cứ nhập hoặc điều chỉnh điểm thi.');
        if (body.expected !== undefined) {
            ensure(body.expected && typeof body.expected === 'object' &&
                typeof body.expected.status === 'string' &&
                (body.expected.score === null || typeof body.expected.score === 'number' && Number.isFinite(body.expected.score)),
                'Dữ liệu điểm ban đầu không hợp lệ.');
            ensure(row.status === body.expected.status &&
                (row.score == null ? null : Number(row.score)) === body.expected.score,
                'Điểm lần thi đã được thay đổi ở phiên khác. Hãy tải lại trước khi lưu.', 409, 'STALE_EXAM_SCORE');
        }
        const next = { status: body.status, score: body.score, reason: body.reason.trim(), approved_by: user.user_id };
        await db.update('exam_registrations', 'exam_registration_id', row.exam_registration_id, next);
        await writeAudit(db, user, 'SAVE_EXAM_SCORE', 'exam_registrations', row.exam_registration_id, { status: row.status, score: row.score }, next, body.reason.trim());
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return { ok: true };
    });
}
