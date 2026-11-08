import { esc } from './format.js';
import { icon } from './icon.js';
export const empty = (title = 'Chưa có dữ liệu', desc = 'Dữ liệu phù hợp sẽ xuất hiện tại đây.', action = '') => `<div class="empty">${icon('layers')}<h3>${esc(title)}</h3><p>${esc(desc)}</p>${action}</div>`;
