import { ensure } from '../../core/errors.js';
import {id} from '../../utils/validation.js';



export async function handleHistory({ db, user, body, patches, p, a, b, n }) {
    ensure(a && !b, 'Lịch sử học vụ chỉ được thêm.');
    const patch = patches.find(x => x.table === 'students' && String(x.id) === String(a.studentId));
    ensure(patch?.after, 'Cần thay đổi hồ sơ đi kèm quyết định.');
    return false;
}
