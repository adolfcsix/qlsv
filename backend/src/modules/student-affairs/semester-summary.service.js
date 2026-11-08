import { ensure } from '../../core/errors.js';
import { id } from '../../utils/validation.js';
import { writeAudit } from '../audit/audit.service.js';

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const round = (number, places = 2) => Number(number.toFixed(places));

async function visibleStudent(db, user, studentId, writing = false) {
    const number = id(studentId);
    if (writing) ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo được lập hoặc duyệt tổng kết.', 403);
    else ensure(['ACADEMIC_STAFF', 'STUDENT'].includes(user.role), 'Không có quyền xem kết quả học vụ.', 403);
    if (user.role === 'STUDENT') {
        const row = await db.get('SELECT student_id FROM students WHERE student_id=? AND user_id=?', [number, user.user_id]);
        ensure(row, 'Không được xem kết quả của sinh viên khác.', 403);
    }
    return number;
}

async function policyContext(db, studentId, semesterId) {
    const student = await db.get('SELECT s.student_id,s.student_code,s.full_name,p.policy_id,p.curriculum_id,p.code AS program_code,ap.code AS policy_code,ap.rules,ap.approved_by FROM students s JOIN student_groups g ON g.student_group_id=s.student_group_id JOIN curricula p ON p.curriculum_id=g.curriculum_id JOIN academic_policies ap ON ap.policy_id=p.policy_id WHERE s.student_id=?', [studentId]);
    ensure(student, 'Không tìm thấy sinh viên.', 404);
    const semester = await db.get('SELECT * FROM semesters WHERE semester_id=?', [id(semesterId)]);
    ensure(semester, 'Không tìm thấy học kỳ.', 404);
    ensure(student.approved_by != null, 'Quy chế chưa được phê duyệt.', 409);
    const policy = typeof student.rules === 'string' ? JSON.parse(student.rules) : student.rules;
    return { student, semester, policy };
}

function configuredRules(policy) {
    const rules = policy.summaryRules;
    ensure(rules && ['latest', 'first_pass'].includes(rules.gpaRepeat) &&
        typeof rules.includeFailedInGpa === 'boolean' && rules.creditRecognition === 'first_pass' &&
        Number.isInteger(rules.roundDecimals) && rules.roundDecimals >= 0 && rules.roundDecimals <= 2,
    'Chưa cấu hình quy tắc tính GPA, chọn lần học và công nhận tín chỉ trong quy chế. Không thể tự suy diễn.', 409, 'SUMMARY_POLICY_MISSING');
    return rules;
}

function weightedGpa(items, includeFailed, decimals) {
    const eligible = items.filter(r => r.outcome === 'passed' || includeFailed && r.outcome === 'failed');
    const credits = eligible.reduce((sum, r) => sum + Number(r.credits_snapshot), 0);
    return credits ? round(eligible.reduce((sum, r) => sum + Number(r.credits_snapshot) * Number(r.grade_point), 0) / credits, decimals) : null;
}

function pickForGpa(rows, rule) {
    if (rule === 'first_pass') return rows.find(r => r.outcome === 'passed') || rows.at(-1);
    return rows.at(-1);
}

// One calculation source for draft creation AND approval. Nothing here publishes a GPA.
export async function previewSummary(db, user, studentId, semesterId) {
    ensure(user.role === 'ACADEMIC_STAFF', 'Bản tính nháp chỉ dành cho cán bộ đào tạo. Sinh viên chỉ xem tổng kết đã duyệt.', 403);
    studentId = await visibleStudent(db, user, studentId);
    const { student, semester, policy } = await policyContext(db, studentId, semesterId);
    const rules = configuredRules(policy);
    const entries = await db.all(`SELECT e.enrollment_id,e.status AS enrollment_status,c.subject_id,su.subject_code,
        sm.semester_id,sm.end_date,cr.result_id,cr.is_published,cr.outcome,cr.credits_snapshot,cr.grade_point,cr.policy_id
        FROM enrollments e JOIN classes c ON c.class_id=e.class_id JOIN subjects su ON su.subject_id=c.subject_id
        JOIN semesters sm ON sm.semester_id=c.semester_id LEFT JOIN course_results cr ON cr.enrollment_id=e.enrollment_id
        WHERE e.student_id=? AND sm.end_date<=? AND e.status NOT IN ('cancelled','withdrawn')
        ORDER BY sm.end_date,e.enrollment_id`, [studentId, semester.end_date]);
    // A transfer between curricula requires a recognition/equivalency decision; do not silently
    // count an old subject outside the student's current curriculum.
    const included=await db.all('SELECT subject_id FROM curriculum_subjects WHERE curriculum_id=?',[student.curriculum_id]);
    const allowed=new Set(included.map(r=>Number(r.subject_id)));
    ensure(entries.every(r=>allowed.has(Number(r.subject_id))),
        'Có học phần ngoài chương trình hiện tại; cần xác minh công nhận tương đương trước khi tổng kết.',
        409,'TRANSFER_REVIEW_REQUIRED');
    const target = entries.filter(r => Number(r.semester_id) === Number(semester.semester_id));
    ensure(target.length, 'Học kỳ chưa có lần học để tổng kết.', 409);
    ensure(entries.every(r => r.is_published && ['passed','failed'].includes(r.outcome) &&
        Number.isFinite(Number(r.grade_point)) && Number(r.grade_point) >= 0 && Number(r.grade_point) <= 4 &&
        Number(r.credits_snapshot) > 0),
    'Có lần học chưa công bố hoặc chưa hoàn thành. Không được tự thay điểm trống bằng 0.', 409, 'INCOMPLETE_RESULTS');
    const bySubject = new Map();
    for (const entry of entries) {
        if (!bySubject.has(entry.subject_id)) bySubject.set(entry.subject_id, []);
        bySubject.get(entry.subject_id).push(entry);
    }
    const recognized = [...bySubject.values()].map(rows => rows.find(r => r.outcome === 'passed')).filter(Boolean);
    const selected = [...bySubject.values()].map(rows => pickForGpa(rows, rules.gpaRepeat));
    const earnedThisTerm = recognized.filter(r => Number(r.semester_id) === Number(semester.semester_id));
    const firstPassInTarget = new Set(earnedThisTerm.map(r => r.subject_id));
    const failedSubjects = [...bySubject.entries()].filter(([subject, rows]) => !rows.some(r => r.outcome === 'passed') && target.some(r => r.subject_id === subject)).map(([, rows]) => rows.at(-1));
    const source = entries.map(r => ({ enrollmentId:r.enrollment_id, resultId:r.result_id, subjectId:r.subject_id,
        semesterId:r.semester_id, outcome:r.outcome, credits:Number(r.credits_snapshot), gpa:Number(r.grade_point) }));
    const calculationDetails = { version:1, rule: { ...rules }, semesterId:Number(semester.semester_id),
        sources:source, recognizedResultIds:recognized.map(r => r.result_id), gpaResultIds:selected.map(r => r.result_id),
        firstPassSubjectsInTerm:[...firstPassInTarget] };
    return {
        studentId, studentCode:student.student_code, studentName:student.full_name,
        semesterId:Number(semester.semester_id), semesterName:semester.name,
        policyId:student.policy_id, policyCode:student.policy_code, demo:!!policy.demo,
        attemptedCredits:target.reduce((n, r) => n + Number(r.credits_snapshot), 0),
        earnedCredits:earnedThisTerm.reduce((n,r) => n + Number(r.credits_snapshot), 0),
        cumulativeEarnedCredits:recognized.reduce((n,r) => n + Number(r.credits_snapshot), 0),
        failedCredits:failedSubjects.reduce((n,r) => n + Number(r.credits_snapshot), 0),
        semesterGpa:weightedGpa(target, rules.includeFailedInGpa, rules.roundDecimals),
        cumulativeGpa:weightedGpa(selected, rules.includeFailedInGpa, rules.roundDecimals),
        calculationDetails
    };
}

export async function listSummaries(db, user, studentId) {
    studentId = await visibleStudent(db, user, studentId);
    const rows = await db.all(`SELECT ss.summary_id AS id,ss.student_id AS studentId,ss.semester_id AS semesterId,
        sm.name AS semesterName,ss.status,ss.revision_no AS revision,ss.is_current AS isCurrent,
        ss.attempted_credits AS attemptedCredits,ss.earned_credits AS earnedCredits,
        ss.cumulative_earned_credits AS cumulativeEarnedCredits,ss.failed_credits AS failedCredits,
        ss.semester_gpa AS semesterGpa,ss.cumulative_gpa AS cumulativeGpa,ss.approved_at AS approvedAt,
        ap.code AS policyCode,ap.rules AS policyRules
        FROM semester_summaries ss JOIN semesters sm ON sm.semester_id=ss.semester_id
        JOIN academic_policies ap ON ap.policy_id=ss.policy_id WHERE ss.student_id=?
        ${user.role === 'STUDENT' ? "AND ss.status='approved' AND ss.is_current=1" : ''}
        ORDER BY sm.end_date DESC,ss.revision_no DESC`, [studentId]);
    return rows.map(({policyRules, ...r}) => ({...r, demo:!!(typeof policyRules === 'string' ? JSON.parse(policyRules) : policyRules)?.demo }));
}

export async function draftSummary(db, user, studentId, semesterId) {
    studentId = await visibleStudent(db, user, studentId, true);
    return db.tx(async () => {
        const preview = await previewSummary(db, user, studentId, semesterId);
        const last = await db.get('SELECT MAX(revision_no) AS number FROM semester_summaries WHERE student_id=? AND semester_id=?', [studentId,id(semesterId)]);
        const revision = Number(last?.number || 0) + 1;
        const values = { student_id:studentId, semester_id:preview.semesterId, policy_id:preview.policyId,
            attempted_credits:preview.attemptedCredits, earned_credits:preview.earnedCredits,
            cumulative_earned_credits:preview.cumulativeEarnedCredits, failed_credits:preview.failedCredits,
            semester_gpa:preview.semesterGpa, cumulative_gpa:preview.cumulativeGpa,
            calculation_details:JSON.stringify(preview.calculationDetails), revision_no:revision,
            status:'draft',is_current:0 };
        const summaryId = await db.insert('semester_summaries', values);
        await writeAudit(db,user,'DRAFT_SEMESTER','semester_summaries',summaryId,null,
            {revision,policyCode:preview.policyCode,demo:preview.demo},'Lập bản tổng kết để đối chiếu và duyệt');
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return {id:summaryId,revision, ...preview};
    });
}

export async function approveSummary(db,user,summaryId) {
    ensure(user.role === 'ACADEMIC_STAFF','Chỉ cán bộ đào tạo có quyền duyệt tổng kết.',403);
    return db.tx(async () => {
        const summary = await db.get('SELECT * FROM semester_summaries WHERE summary_id=?',[id(summaryId)]);
        ensure(summary,'Không tìm thấy bản tổng kết.',404);
        ensure(summary.status === 'draft','Chỉ có thể duyệt bản nháp.',409);
        const preview = await previewSummary(db,user,summary.student_id,summary.semester_id);
        ensure(summary.policy_id === preview.policyId &&
            JSON.stringify(JSON.parse(summary.calculation_details)) === JSON.stringify(preview.calculationDetails) &&
            Number(summary.cumulative_gpa) === Number(preview.cumulativeGpa) &&
            Number(summary.semester_gpa) === Number(preview.semesterGpa) &&
            Number(summary.attempted_credits) === preview.attemptedCredits &&
            Number(summary.earned_credits) === preview.earnedCredits &&
            Number(summary.failed_credits) === preview.failedCredits &&
            Number(summary.cumulative_earned_credits) === preview.cumulativeEarnedCredits,
        'Nguồn điểm hoặc quy chế đã thay đổi. Cần lập lại bản tổng kết.',409,'STALE_SUMMARY');
        ensure(preview.demo || process.env.ALLOW_OFFICIAL_PUBLICATION === '1',
            'Chưa bật duyệt tổng kết chính thức theo quy chế được trường xác nhận.',409,'POLICY_NOT_CONFIRMED');
        const active = await db.get('SELECT summary_id FROM semester_summaries WHERE student_id=? AND semester_id=? AND is_current=1',[summary.student_id,summary.semester_id]);
        if(active) {
            const warning = await db.get("SELECT warning_id FROM academic_warnings WHERE summary_id=? AND status='approved'",[active.summary_id]);
            ensure(!warning,'Tổng kết cũ đã gắn quyết định cảnh báo. Cần thu hồi hoặc xử lý quyết định trước.',409);
            await db.update('semester_summaries','summary_id',active.summary_id,{is_current:0});
        }
        const applied = {status:'approved',is_current:1,approved_by:user.user_id,approved_at:now()};
        await db.update('semester_summaries','summary_id',summary.summary_id,applied);
        await writeAudit(db,user,'APPROVE_SEMESTER','semester_summaries',summary.summary_id,
            {status:summary.status,revision:summary.revision_no},applied,'Duyệt bản tổng kết đã đối chiếu nguồn điểm');
        await db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');
        return {id:summary.summary_id, revision:summary.revision_no, status:'approved',demo:preview.demo};
    });
}
