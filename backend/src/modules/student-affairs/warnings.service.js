import { ensure } from '../../core/errors.js';
import { id } from '../../utils/validation.js';
import { writeAudit } from '../audit/audit.service.js';
const now = () => new Date().toISOString().slice(0,19).replace('T',' ');

async function context(db, summaryId) {
    const row = await db.get(`SELECT ss.*,sm.start_date,ap.rules AS policy_rules,s.user_id AS student_user_id
        FROM semester_summaries ss JOIN semesters sm ON sm.semester_id=ss.semester_id
        JOIN academic_policies ap ON ap.policy_id=ss.policy_id
        JOIN students s ON s.student_id=ss.student_id WHERE ss.summary_id=?`,[id(summaryId)]);
    ensure(row,'Không tìm thấy tổng kết học kỳ.',404);
    const policy = typeof row.policy_rules === 'string' ? JSON.parse(row.policy_rules) : row.policy_rules;
    const rules = policy.warningRules;
    ensure(rules && Number.isFinite(rules.cumulativeGpaBelow) && Number.isInteger(rules.level) &&
        rules.level > 0 && typeof rules.leaveBreaksSequence === 'boolean',
        'Chưa cấu hình ngưỡng và cách tính cảnh báo của trường.',409,'WARNING_POLICY_MISSING');
    return {row,policy,rules};
}

function warningReason(summary,rules) {
    const causes = [];
    if(summary.cumulative_gpa !== null && Number(summary.cumulative_gpa)<rules.cumulativeGpaBelow)
        causes.push(`GPA tích lũy ${summary.cumulative_gpa} thấp hơn ngưỡng ${rules.cumulativeGpaBelow}`);
    if(Number.isInteger(rules.semesterEarnedCreditsBelow) && Number(summary.earned_credits)<rules.semesterEarnedCreditsBelow)
        causes.push(`Tín chỉ đạt trong kỳ ${summary.earned_credits} thấp hơn ngưỡng ${rules.semesterEarnedCreditsBelow}`);
    return causes;
}

async function countConsecutive(db, summary, rules) {
    // Count only adjacent academic terms; no inference from a raw number of warnings.
    const prev = await db.get('SELECT semester_id FROM semesters WHERE end_date<? ORDER BY end_date DESC LIMIT 1',[summary.start_date]);
    if (!prev) return 1;
    const prior = await db.get(`SELECT w.consecutive_count, ss.status,ss.is_current
        FROM semester_summaries ss JOIN academic_warnings w ON w.summary_id=ss.summary_id
        WHERE ss.student_id=? AND ss.semester_id=? AND w.status='approved'
        AND ss.status='approved' AND ss.is_current=1`,[summary.student_id,prev.semester_id]);
    // Explicit demo policy treats a semester without a current warning as a break.
    if (!prior && rules.leaveBreaksSequence) return 1;
    // If the policy doesn't specify how a gap should count, require a human policy clarification.
    ensure(prior || rules.leaveBreaksSequence,'Chưa rõ cách đếm cảnh báo liên tiếp khi có kỳ gián đoạn.',409);
    return prior ? Number(prior.consecutive_count) + 1 : 1;
}

export async function listWarnings(db, user, studentId) {
    const number = id(studentId);
    ensure(['ACADEMIC_STAFF','STUDENT'].includes(user.role),'Không có quyền truy cập cảnh báo.',403);
    if(user.role === 'STUDENT')
        ensure(await db.get('SELECT student_id FROM students WHERE student_id=? AND user_id=?',[number,user.user_id]),'Không được xem cảnh báo của người khác.',403);
    const where = user.role === 'STUDENT' ? "AND w.status='approved' AND ss.status='approved' AND ss.is_current=1" : '';
    return db.all(`SELECT w.warning_id AS id,w.summary_id AS summaryId,w.warning_level AS level,
        w.consecutive_count AS consecutiveCount,w.reason,w.status,w.decision_number AS decisionNumber,
        w.approved_at AS approvedAt,w.revoke_reason AS revokeReason,ss.semester_id AS semesterId,sm.name AS semesterName
        FROM academic_warnings w JOIN semester_summaries ss ON ss.summary_id=w.summary_id
        JOIN semesters sm ON sm.semester_id=ss.semester_id
        WHERE ss.student_id=? ${where} ORDER BY sm.end_date DESC`,[number]);
}

export async function draftWarning(db,user,summaryId) {
    ensure(user.role === 'ACADEMIC_STAFF','Chỉ cán bộ đào tạo được lập cảnh báo.',403);
    return db.tx(async()=>{
        const {row,policy,rules}=await context(db,summaryId);
        ensure(row.status==='approved' && row.is_current,'Chỉ lập cảnh báo từ bản tổng kết hiện hành đã duyệt.',409);
        const reasons=warningReason(row,rules);
        ensure(reasons.length,'Dữ liệu chưa thỏa điều kiện cảnh báo đã cấu hình.',409);
        const existing=await db.get('SELECT warning_id FROM academic_warnings WHERE summary_id=?',[row.summary_id]);
        ensure(!existing,'Bản tổng kết đã có cảnh báo; không tạo trùng.',409);
        const count=await countConsecutive(db,row,rules);
        const values={summary_id:row.summary_id,warning_level:rules.level,consecutive_count:count,
            reason:reasons.join('; '),status:'draft'};
        const warningId=await db.insert('academic_warnings',values);
        await writeAudit(db,user,'DRAFT_WARNING','academic_warnings',warningId,null,
            {summaryId:row.summary_id,...values,demo:!!policy.demo},'Lập dự thảo cảnh báo theo quy tắc đã cấu hình');
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return {id:warningId,status:'draft',reason:values.reason,consecutiveCount:count,demo:!!policy.demo};
    });
}

export async function approveWarning(db,user,warningId,decisionNumber) {
    ensure(user.role==='ACADEMIC_STAFF','Chỉ cán bộ đào tạo có quyền phê duyệt.',403);
    ensure(typeof decisionNumber==='string' && decisionNumber.trim().length>=3 && decisionNumber.length<=100,
        'Cần số quyết định hợp lệ.');
    return db.tx(async()=>{
        const warning=await db.get('SELECT * FROM academic_warnings WHERE warning_id=?',[id(warningId)]);
        ensure(warning,'Không tìm thấy cảnh báo.',404);
        ensure(warning.status==='draft','Chỉ duyệt dự thảo chưa được quyết định.',409);
        const {row,policy,rules}=await context(db,warning.summary_id);
        ensure(row.status==='approved' && row.is_current,'Bản tổng kết đã hết hiệu lực.',409);
        const reasons=warningReason(row,rules);
        ensure(reasons.length && warning.reason===reasons.join('; ') &&
            warning.warning_level===rules.level && warning.consecutive_count===await countConsecutive(db,row,rules),
            'Căn cứ hoặc quy tắc cảnh báo đã thay đổi. Cần lập lại dự thảo.',409,'STALE_WARNING');
        ensure(policy.demo || process.env.ALLOW_OFFICIAL_PUBLICATION==='1',
            'Chưa bật duyệt cảnh báo chính thức theo quy chế được trường xác nhận.',409);
        const values={status:'approved',decision_number:decisionNumber.trim(),approved_by:user.user_id,approved_at:now()};
        await db.update('academic_warnings','warning_id',warning.warning_id,values);
        await writeAudit(db,user,'APPROVE_WARNING','academic_warnings',warning.warning_id,
            {status:'draft'},values,'Duyệt quyết định cảnh báo có căn cứ');
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return {id:warning.warning_id,status:'approved',demo:!!policy.demo};
    });
}

export async function revokeWarning(db,user,warningId,reason) {
    ensure(user.role==='ACADEMIC_STAFF','Chỉ cán bộ đào tạo có quyền thu hồi.',403);
    ensure(typeof reason==='string' && reason.trim().length>=10 && reason.length<=1000,'Cần lý do thu hồi rõ ràng.');
    return db.tx(async()=>{
        const warning=await db.get('SELECT * FROM academic_warnings WHERE warning_id=?',[id(warningId)]);
        ensure(warning,'Không tìm thấy cảnh báo.',404);
        ensure(warning.status==='approved','Chỉ thu hồi quyết định đã duyệt.',409);
        const values={status:'revoked',revoke_reason:reason.trim()};
        await db.update('academic_warnings','warning_id',warning.warning_id,values);
        await writeAudit(db,user,'REVOKE_WARNING','academic_warnings',warning.warning_id,
            {status:'approved',decisionNumber:warning.decision_number},values,reason.trim());
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return {id:warning.warning_id,status:'revoked'};
    });
}
