import { ensure } from '../../core/errors.js';
import { id } from '../../utils/validation.js';
import { getCurriculumStructure, studentAttempts } from './curriculum.repository.js';

export async function progress(db, user, requestedStudentId) {
    ensure(['ACADEMIC_STAFF', 'STUDENT'].includes(user.role), 'Không có quyền tra cứu tiến độ học tập.', 403);
    const studentId = user.role === 'STUDENT' ? null : id(requestedStudentId);
    const student = await db.get(`SELECT s.student_id AS id, s.student_code AS code,
        s.full_name AS name, g.curriculum_id AS curriculumId
        FROM students s JOIN student_groups g ON g.student_group_id=s.student_group_id
        WHERE ${user.role === 'STUDENT' ? 's.user_id=?' : 's.student_id=?'}`,
        [user.role === 'STUDENT' ? user.user_id : studentId]);
    ensure(student, 'Không tìm thấy hồ sơ sinh viên thuộc quyền truy cập.', 404);
    const structure = await getCurriculumStructure(db, student.curriculumId);
    ensure(structure, 'Hồ sơ chưa có chương trình đào tạo hợp lệ.', 409);
    const attempts = await studentAttempts(db, student.id);
    // Only approved and not revoked recognition decisions count. They affect
    // curriculum progress, not the GPA algorithm or historical attempt scores.
    const recognitions = await db.all(`SELECT r.recognition_id AS id, cs.subject_id AS targetSubjectId,
        r.source_result_id AS resultId, r.decision_number AS decisionNumber
        FROM credit_recognitions r JOIN curriculum_subjects cs
        ON cs.curriculum_subject_id=r.target_assignment_id
        JOIN course_results cr ON cr.result_id=r.source_result_id
        JOIN enrollments e ON e.enrollment_id=cr.enrollment_id
        WHERE r.student_id=? AND cs.curriculum_id=? AND r.revoked_at IS NULL
        AND cr.is_published=1 AND cr.outcome='passed' AND e.student_id=?
        AND e.status NOT IN ('cancelled','withdrawn')`,
        [student.id, student.curriculumId, student.id]);
    const byRecognizedTarget = new Map(recognitions.map(r => [Number(r.targetSubjectId), r]));
    const recognizedSources = new Set(recognitions.map(r => Number(r.resultId)));
    const bySubject = new Map();
    for (const entry of attempts) {
        const key = Number(entry.subjectId);
        if (!bySubject.has(key)) bySubject.set(key, []);
        bySubject.get(key).push(entry);
    }
    const assigned = new Set(structure.subjects.map(subject => Number(subject.subjectId)));
    const passed = new Set();
    const recognized = new Map();
    for (const [subjectId, rows] of bySubject) {
        const first = rows.find(r => Number(r.isPublished) === 1 && r.outcome === 'passed');
        if (first && assigned.has(subjectId)) {
            passed.add(subjectId);
            recognized.set(subjectId, first);
        }
    }
    const prerequisiteMap = new Map();
    for (const entry of structure.prerequisites) {
        const target = Number(entry.subjectId);
        if (!prerequisiteMap.has(target)) prerequisiteMap.set(target, []);
        prerequisiteMap.get(target).push({ subjectId: Number(entry.prerequisiteSubjectId), code: entry.prerequisiteCode });
    }
    const subjects = structure.subjects.map(subject => {
        const rows = bySubject.get(Number(subject.subjectId)) || [];
        const accepted = recognized.get(Number(subject.subjectId));
        const equivalent = accepted ? null : byRecognizedTarget.get(Number(subject.subjectId));
        const pending = rows.some(r => !r.resultId || Number(r.isPublished) !== 1 || !['passed', 'failed'].includes(r.outcome));
        const failed = rows.some(r => Number(r.isPublished) === 1 && r.outcome === 'failed');
        const prerequisites = (prerequisiteMap.get(Number(subject.subjectId)) || []).map(p => ({
            ...p, passed: passed.has(p.subjectId), inCurriculum: assigned.has(p.subjectId)
        }));
        return { ...subject,
            learningStatus: accepted || equivalent ? 'passed' : pending ? 'in_progress' : failed ? 'failed' : 'not_started',
            recognizedCredits: accepted ? Number(accepted.creditsSnapshot) : equivalent ? Number(subject.credits) : 0,
            recognizedResultId: accepted ? accepted.resultId : equivalent ? equivalent.resultId : null,
            recognitionId: equivalent?.id || null,
            recognitionDecision: equivalent?.decisionNumber || null,
            creditMismatch: !!accepted && Number(accepted.creditsSnapshot) !== Number(subject.credits),
            prerequisites, prerequisitesMet: prerequisites.every(p => p.passed) };
    });
    const electiveGroups = structure.electiveGroups.map(group => {
        const within = subjects.filter(s => Number(s.electiveGroupId) === Number(group.id));
        const credits = within.reduce((n, s) => n + s.recognizedCredits, 0);
        return { ...group, availableCredits: within.reduce((n, s) => n + Number(s.credits), 0),
            earnedCredits: credits, remainingCredits: Math.max(0, Number(group.minimumCredits) - credits) };
    });
    const earnedCredits = subjects.reduce((n, subject) => n + subject.recognizedCredits, 0);
    const requiredOutstanding = subjects.filter(s => s.requirementType === 'required' && s.learningStatus !== 'passed').length;
    const unrecognized = [...bySubject.entries()].filter(([subjectId, rows]) => !assigned.has(subjectId) &&
        rows.some(r => Number(r.isPublished) === 1 && r.outcome === 'passed' && !recognizedSources.has(Number(r.resultId))))
        .map(([, rows]) => rows[0].subjectCode);
    const needsCreditReview = subjects.some(s => s.creditMismatch);
    const unmetElectives = electiveGroups.filter(g => g.remainingCredits > 0).length;
    const requiredCredits = Number(structure.program.requiredCredits);
    return { student, program: structure.program, subjects, electiveGroups,
        earnedCredits, requiredCredits, remainingCredits: Math.max(0, requiredCredits - earnedCredits),
        requiredOutstanding, unmetElectives, unrecognizedSubjects: unrecognized,
        needsCreditReview,
        readyForManualReview: earnedCredits >= requiredCredits && requiredOutstanding === 0 &&
            unmetElectives === 0 && !needsCreditReview && unrecognized.length === 0,
        note: 'Tiến độ có tính công nhận tương đương đang hiệu lực nhưng không phải quyết định tốt nghiệp; không tự tính điểm GPA từ công nhận này.' };
}

