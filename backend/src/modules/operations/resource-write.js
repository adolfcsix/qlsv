import { ensure } from '../../core/errors.js';
import { academic } from './change-utils.js';
import { applyChanges } from './changes.service.js';

const editableFields = {
    cohorts: new Set(['id', 'code', 'name', 'year']),
    departments: new Set(['id', 'code', 'name']),
    majors: new Set(['id', 'code', 'name', 'departmentId']),
    programs: new Set(['id', 'code', 'name', 'majorId', 'cohortId', 'credits']),
    groups: new Set(['id', 'code', 'name', 'programId', 'advisor', 'capacity']),
    students: new Set(['id', 'code', 'name', 'dob', 'gender', 'email', 'phone',
        'address', 'admissionDate', 'groupId', 'status', 'photoData', 'photoUrl'])
};

// Resource routes reuse the same audited transaction, validation and revision guard
// as the old /changes endpoint. There is only ONE place that writes each table.
export async function writeResource(ctx, table, method, rowId = null) {
    academic(ctx.user);
    const body = await ctx.body();
    ensure(body && typeof body === 'object' && !Array.isArray(body) &&
        Number.isSafeInteger(body.revision), 'Phiên bản dữ liệu không hợp lệ.');
    const create = method === 'POST';
    const removing = method === 'DELETE';
    const after = removing ? null : body.after;
    const before = create ? null : body.before;
    ensure(create || /^[1-9]\d*$/.test(String(rowId)), 'Mã bản ghi không hợp lệ.');
    if (!create) {
        ensure(before && typeof before === 'object' && String(before.id) === String(rowId),
            'Cần tải lại bản ghi trước khi thay đổi.');
    }
    if (!removing) {
        ensure(after && typeof after === 'object' && !Array.isArray(after),
            'Thiếu dữ liệu cần lưu.');
        ensure(Object.keys(after).every(field => editableFields[table].has(field)),
            'Biểu mẫu có trường không được phép cập nhật.', 403, 'FIELD_FORBIDDEN');
        if (!create)
            ensure(String(after.id) === String(rowId), 'Không được đổi mã định danh.');
    }
    const changes = [{ table, id: rowId || after.id || 'new', before, after }];
    if (body.decision !== undefined) {
        ensure(table === 'students' && method === 'PATCH',
            'Quyết định học vụ chỉ áp dụng khi sửa hồ sơ sinh viên.');
        const decision = body.decision;
        ensure(decision && typeof decision === 'object' && !Array.isArray(decision),
            'Thiếu thông tin quyết định học vụ.');
        ensure(Object.keys(decision).every(field => ['date', 'decision', 'reason'].includes(field)),
            'Quyết định chứa thông tin không hợp lệ.');
        ensure(after.status !== before.status || after.groupId !== before.groupId,
            'Quyết định phải gắn với một biến động học vụ.');
        changes.push({ table: 'history', id: 'new-history', before: null,
            after: { ...decision, studentId: rowId } });
    }
    const result = await applyChanges(ctx.db, ctx.user, {
        revision: body.revision, changes
    });
    ctx.json(create ? 201 : 200, { data: result });
}
