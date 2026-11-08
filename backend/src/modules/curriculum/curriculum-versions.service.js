import { ensure } from '../../core/errors.js';
import { id, text } from '../../utils/validation.js';
import { academicMutation, auditRevision } from '../operations/revision.js';
import { isCurriculumLocked } from './curriculum.repository.js';

const timestamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export async function listCurriculumVersions(db, user, curriculumId) {
    ensure(user.role === 'ACADEMIC_STAFF', 'Chỉ cán bộ đào tạo được tra cứu phiên bản.', 403);
    const key = id(curriculumId);
    return db.all(`SELECT cv.version_id AS id, cv.source_curriculum_id AS sourceId,
        cv.target_curriculum_id AS targetId, cv.status, cv.note,
        cv.created_at AS createdAt, cv.approved_at AS approvedAt,
        source.code AS sourceCode, target.code AS targetCode
        FROM curriculum_versions cv JOIN curricula source ON source.curriculum_id=cv.source_curriculum_id
        JOIN curricula target ON target.curriculum_id=cv.target_curriculum_id
        WHERE cv.source_curriculum_id=? OR cv.target_curriculum_id=?
        ORDER BY cv.version_id DESC`, [key, key]);
}

export async function cloneCurriculum(db, user, input) {
    return academicMutation(db, user, input.revision, async () => {
        const sourceId = id(input.sourceCurriculumId);
        const code = text(input.code, 'Mã phiên bản chương trình', 50);
        const name = text(input.name, 'Tên phiên bản chương trình', 200);
        const note = text(input.note, 'Lý do lập phiên bản', 500);
        const source = await db.get('SELECT * FROM curricula WHERE curriculum_id=?', [sourceId]);
        ensure(source, 'Chương trình nguồn không tồn tại.', 404);
        const unfinishedParent = await db.get(`SELECT 1 AS used FROM curriculum_versions
            WHERE target_curriculum_id=? AND status='draft'`, [sourceId]);
        ensure(!unfinishedParent, 'Cần duyệt phiên bản hiện tại trước khi lập bản kế tiếp.', 409);
        const prior = await db.get('SELECT version_id FROM curriculum_versions WHERE source_curriculum_id=? AND status=\'draft\'', [sourceId]);
        ensure(!prior, 'Chương trình đang có một bản kế tiếp chưa duyệt.', 409);
        const targetId = await db.insert('curricula', {
            code, name, major_id: source.major_id, policy_id: source.policy_id,
            admission_year: source.admission_year, required_credits: source.required_credits
        });
        const groups = await db.all('SELECT * FROM elective_groups WHERE curriculum_id=? ORDER BY elective_group_id', [sourceId]);
        const assignments = await db.all('SELECT * FROM curriculum_subjects WHERE curriculum_id=? ORDER BY curriculum_subject_id', [sourceId]);
        const mapping = new Map();
        for (const row of groups) {
            const newId = await db.insert('elective_groups', { curriculum_id: targetId, code: row.code,
                name: row.name, minimum_credits: row.minimum_credits });
            mapping.set(Number(row.elective_group_id), newId);
        }
        for (const row of assignments) await db.insert('curriculum_subjects', {
            curriculum_id: targetId, subject_id: row.subject_id, recommended_semester: row.recommended_semester,
            requirement_type: row.requirement_type,
            elective_group_id: row.elective_group_id == null ? null : mapping.get(Number(row.elective_group_id))
        });
        const versionId = await db.insert('curriculum_versions', { source_curriculum_id: sourceId,
            target_curriculum_id: targetId, status:'draft', note, created_by:user.user_id,
            created_at:timestamp(), approved_by:null, approved_at:null });
        await auditRevision(db, user, 'CLONE_CURRICULUM', 'curriculum_versions', versionId,
            null, { sourceId, targetId, code, groupCount: groups.length, subjectCount: assignments.length }, note);
        return { id: versionId, sourceCurriculumId: sourceId, targetCurriculumId: targetId, status:'draft' };
    });
}

export async function approveCurriculumVersion(db, user, versionId, input) {
    return academicMutation(db, user, input.revision, async () => {
        const row = await db.get('SELECT * FROM curriculum_versions WHERE version_id=?', [id(versionId)]);
        ensure(row, 'Không tìm thấy phiên bản.', 404);
        ensure(row.status === 'draft', 'Phiên bản đã được duyệt.', 409);
        ensure(!await isCurriculumLocked(db, row.target_curriculum_id), 'Phiên bản đã có hoạt động học, không thể duyệt thay đổi.', 409);
        const subjectCount = await db.get('SELECT COUNT(*) AS n FROM curriculum_subjects WHERE curriculum_id=?', [row.target_curriculum_id]);
        ensure(Number(subjectCount.n) > 0, 'Chương trình chưa có học phần.', 409);
        const groups = await db.all('SELECT * FROM elective_groups WHERE curriculum_id=?', [row.target_curriculum_id]);
        for (const g of groups) {
            const available = await db.get(`SELECT COALESCE(SUM(s.credits),0) AS credits
                FROM curriculum_subjects cs JOIN subjects s ON s.subject_id=cs.subject_id
                WHERE cs.elective_group_id=?`, [g.elective_group_id]);
            ensure(Number(available.credits) >= Number(g.minimum_credits),
                `Nhóm ${g.code} chưa đủ số tín chỉ tự chọn tối thiểu.`, 409);
        }
        const approvedAt = timestamp();
        await db.update('curriculum_versions', 'version_id', row.version_id,
            { status:'approved', approved_by:user.user_id, approved_at:approvedAt });
        await auditRevision(db, user, 'APPROVE_CURRICULUM_VERSION', 'curriculum_versions', row.version_id,
            { status:row.status }, {status:'approved', targetId:row.target_curriculum_id}, 'Duyệt cấu trúc phiên bản chương trình');
        return { id:row.version_id, status:'approved', targetCurriculumId:row.target_curriculum_id };
    });
}
