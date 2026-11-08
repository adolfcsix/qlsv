import { ensure } from '../../core/errors.js';
import { id, text, enumeration } from '../../utils/validation.js';
import { academicMutation, auditRevision } from '../operations/revision.js';
import { getCurriculumStructure, isCurriculumLocked } from './curriculum.repository.js';

const positive = (number, label, max = 10000) => {
    const parsed = Number(number);
    ensure(Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max, `${label} phải là số nguyên dương.`);
    return parsed;
};
const optionalSemester = value => value == null || value === '' ? null : positive(value, 'Học kỳ gợi ý', 30);
const updated = (db, user, action, table, entityId, before, after) =>
    auditRevision(db, user, action, table, entityId, before, after,
        'Điều chỉnh cấu trúc chương trình có kiểm tra phiên bản');

async function writableProgram(db, curriculumId) {
    const program = await db.get('SELECT curriculum_id FROM curricula WHERE curriculum_id=?', [id(curriculumId)]);
    ensure(program, 'Không tìm thấy chương trình đào tạo.', 404, 'NOT_FOUND');
    const version = await db.get(`SELECT version_id FROM curriculum_versions
        WHERE (target_curriculum_id=? AND status='approved') OR source_curriculum_id=? LIMIT 1`,
        [program.curriculum_id, program.curriculum_id]);
    ensure(!version, 'Chương trình đã có phiên bản kế tiếp hoặc đã được duyệt; không thể sửa trực tiếp.', 409, 'CURRICULUM_VERSION_REQUIRED');
    ensure(!await isCurriculumLocked(db, program.curriculum_id),
        'Chương trình đã có sinh viên đăng ký học hoặc tổng kết được duyệt. Cần lập phiên bản chương trình mới, không sửa lịch sử.',
        409, 'CURRICULUM_VERSION_REQUIRED');
    return program.curriculum_id;
}
async function electiveGroup(db, curriculumId, groupId) {
    const group = await db.get('SELECT * FROM elective_groups WHERE elective_group_id=? AND curriculum_id=?',
        [id(groupId), curriculumId]);
    ensure(group, 'Nhóm tự chọn phải thuộc đúng chương trình đào tạo.', 422);
    return group;
}
async function assignmentFields(db, data, curriculumId) {
    const kind = enumeration(data.requirementType, ['required', 'elective'], 'Loại học phần');
    let electiveGroupId = null;
    if (kind === 'elective') {
        ensure(data.electiveGroupId !== undefined && data.electiveGroupId !== null && data.electiveGroupId !== '',
            'Học phần tự chọn phải thuộc một nhóm tự chọn.');
        electiveGroupId = (await electiveGroup(db, curriculumId, data.electiveGroupId)).elective_group_id;
    } else ensure(data.electiveGroupId == null || data.electiveGroupId === '',
        'Học phần bắt buộc không được liên kết nhóm tự chọn.');
    return { requirement_type: kind, elective_group_id: electiveGroupId,
        recommended_semester: optionalSemester(data.recommendedSemester) };
}

export async function getPlan(db, user, curriculumId) {
    const number = id(curriculumId);
    ensure(['ACADEMIC_STAFF', 'STUDENT'].includes(user.role), 'Không có quyền xem chương trình.', 403);
    if (user.role === 'STUDENT') {
        const found = await db.get(`SELECT 1 AS allowed FROM students s
          JOIN student_groups g ON g.student_group_id=s.student_group_id
          WHERE s.user_id=? AND g.curriculum_id=?`, [user.user_id, number]);
        ensure(found, 'Chỉ được xem chương trình của chính mình.', 403);
    }
    const result = await getCurriculumStructure(db, number);
    ensure(result, 'Không tìm thấy chương trình đào tạo.', 404);
    const version = await db.get(`SELECT 1 AS locked FROM curriculum_versions
        WHERE source_curriculum_id=? OR (target_curriculum_id=? AND status='approved') LIMIT 1`, [number, number]);
    return { ...result, editable: user.role === 'ACADEMIC_STAFF' && !version && !await isCurriculumLocked(db, number) };
}


const mutation = academicMutation;

export async function saveElectiveGroup(db, user, input, groupId) {
    return mutation(db, user, input.revision, async () => {
        const old = groupId ? await db.get('SELECT * FROM elective_groups WHERE elective_group_id=?', [id(groupId)]) : null;
        if (groupId) ensure(old, 'Không tìm thấy nhóm tự chọn.', 404);
        const curriculumId = await writableProgram(db, old?.curriculum_id ?? input.curriculumId);
        const values = { code: text(input.code, 'Mã nhóm', 255), name: text(input.name, 'Tên nhóm', 255),
            minimum_credits: positive(input.minimumCredits, 'Tín chỉ tối thiểu', 1000) };
        if (old) await db.update('elective_groups', 'elective_group_id', old.elective_group_id, values);
        else groupId = await db.insert('elective_groups', { curriculum_id: curriculumId, ...values });
        await updated(db, user, old ? 'UPDATE_ELECTIVE_GROUP' : 'CREATE_ELECTIVE_GROUP',
            'elective_groups', groupId, old, values);
        return { id: Number(groupId) };
    });
}
export async function removeElectiveGroup(db, user, groupId, revision) {
    return mutation(db, user, revision, async () => {
        const row = await db.get('SELECT * FROM elective_groups WHERE elective_group_id=?', [id(groupId)]);
        ensure(row, 'Không tìm thấy nhóm tự chọn.', 404);
        await writableProgram(db, row.curriculum_id);
        const linked = await db.get('SELECT 1 AS used FROM curriculum_subjects WHERE elective_group_id=? LIMIT 1', [row.elective_group_id]);
        ensure(!linked, 'Nhóm tự chọn đang có học phần; cần chuyển học phần trước.', 409);
        await db.run('DELETE FROM elective_groups WHERE elective_group_id=?', [row.elective_group_id]);
        await updated(db, user, 'DELETE_ELECTIVE_GROUP', 'elective_groups', row.elective_group_id, row, null);
        return { id: row.elective_group_id };
    });
}
export async function saveCurriculumSubject(db, user, input, assignmentId) {
    return mutation(db, user, input.revision, async () => {
        const old = assignmentId ? await db.get('SELECT * FROM curriculum_subjects WHERE curriculum_subject_id=?', [id(assignmentId)]) : null;
        if (assignmentId) ensure(old, 'Không tìm thấy học phần trong chương trình.', 404);
        const curriculumId = await writableProgram(db, old?.curriculum_id ?? input.curriculumId);
        const changes = await assignmentFields(db, input, curriculumId);
        if (old) {
            ensure(input.subjectId == null || Number(input.subjectId) === Number(old.subject_id),
                'Không được đổi môn của một dòng chương trình; hãy dùng phiên bản mới.');
            await db.update('curriculum_subjects', 'curriculum_subject_id', old.curriculum_subject_id, changes);
        } else {
            const subjectId = id(input.subjectId);
            const subject = await db.get("SELECT subject_id FROM subjects WHERE subject_id=? AND status='active'", [subjectId]);
            ensure(subject, 'Chọn học phần đang hoạt động.', 422);
            assignmentId = await db.insert('curriculum_subjects', {
                curriculum_id: curriculumId, subject_id: subjectId, ...changes
            });
        }
        await updated(db, user, old ? 'UPDATE_CURRICULUM_SUBJECT' : 'CREATE_CURRICULUM_SUBJECT',
            'curriculum_subjects', assignmentId, old, changes);
        return { id: Number(assignmentId) };
    });
}
export async function removeCurriculumSubject(db, user, assignmentId, revision) {
    return mutation(db, user, revision, async () => {
        const row = await db.get('SELECT * FROM curriculum_subjects WHERE curriculum_subject_id=?', [id(assignmentId)]);
        ensure(row, 'Không tìm thấy học phần trong chương trình.', 404);
        await writableProgram(db, row.curriculum_id);
        await db.run('DELETE FROM curriculum_subjects WHERE curriculum_subject_id=?', [row.curriculum_subject_id]);
        await updated(db, user, 'DELETE_CURRICULUM_SUBJECT', 'curriculum_subjects', row.curriculum_subject_id, row, null);
        return { id: row.curriculum_subject_id };
    });
}

export async function updatePrerequisite(db, user, input, remove = false) {
    return mutation(db, user, input.revision, async () => {
        const subjectId = id(input.subjectId);
        const prerequisiteId = id(input.prerequisiteSubjectId);
        ensure(subjectId !== prerequisiteId, 'Một học phần không thể tiên quyết chính nó.');
        const subjects = await db.all('SELECT subject_id FROM subjects WHERE subject_id IN (?,?)', [subjectId, prerequisiteId]);
        ensure(subjects.length === 2, 'Học phần tiên quyết hoặc học phần đích không tồn tại.', 404);
        // Global prerequisite graph: changing a subject with existing enrollments would
        // alter conditions retroactively, so a new academic policy must be agreed first.
        const used = await db.get(`SELECT 1 AS used FROM enrollments e JOIN classes c ON c.class_id=e.class_id
            WHERE c.subject_id=? LIMIT 1`, [subjectId]);
        const publishedVersion = await db.get(`SELECT 1 AS used FROM curriculum_versions cv
            JOIN curriculum_subjects cs ON cs.curriculum_id=cv.target_curriculum_id
            WHERE cv.status='approved' AND cs.subject_id=? LIMIT 1`, [subjectId]);
        ensure(!publishedVersion, 'Môn đã thuộc phiên bản chương trình được duyệt; không đổi tiên quyết toàn trường.',
            409, 'PREREQUISITE_VERSION_REQUIRED');
        ensure(!used, 'Học phần đã có sinh viên theo học; không tự đổi điều kiện tiên quyết lịch sử.',
            409, 'PREREQUISITE_VERSION_REQUIRED');
        const existing = await db.get('SELECT 1 AS used FROM subject_prerequisites WHERE subject_id=? AND prerequisite_subject_id=?',
            [subjectId, prerequisiteId]);
        if (remove) {
            ensure(existing, 'Không tìm thấy quan hệ tiên quyết.', 404);
            await db.run('DELETE FROM subject_prerequisites WHERE subject_id=? AND prerequisite_subject_id=?', [subjectId, prerequisiteId]);
        } else {
            ensure(!existing, 'Quan hệ tiên quyết đã tồn tại.', 409);
            const edges = await db.all('SELECT subject_id,prerequisite_subject_id FROM subject_prerequisites');
            const stack = [prerequisiteId];
            const visited = new Set();
            while (stack.length) {
                const next = stack.pop();
                ensure(next !== subjectId, 'Tạo vòng phụ thuộc giữa các học phần tiên quyết.', 409, 'PREREQUISITE_CYCLE');
                if (visited.has(next)) continue;
                visited.add(next);
                for (const e of edges) if (Number(e.subject_id) === next) stack.push(Number(e.prerequisite_subject_id));
            }
            await db.insert('subject_prerequisites', { subject_id: subjectId, prerequisite_subject_id: prerequisiteId });
        }
        await updated(db, user, remove ? 'DELETE_PREREQUISITE' : 'CREATE_PREREQUISITE',
            'subject_prerequisites', `${subjectId}:${prerequisiteId}`, remove ? {subjectId,prerequisiteId} : null,
            remove ? null : {subjectId,prerequisiteId});
        return { subjectId, prerequisiteSubjectId: prerequisiteId };
    });
}
