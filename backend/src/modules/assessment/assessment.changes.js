import { ensure } from '../../core/errors.js';
import { changed } from '../operations/change-utils.js';
import { saveDraftGrade } from './gradebook.service.js';

// Compatibility path uses the same writer as the dedicated gradebook API.
export async function handleGrades({ db, user, a, b, n }) {
    ensure(a && b, 'Chỉ cập nhật dòng điểm hiện có.');
    changed(b, a, ['process', 'midterm']);
    await saveDraftGrade(db, user, n, { process: a.process, midterm: a.midterm });
    return true;
}
