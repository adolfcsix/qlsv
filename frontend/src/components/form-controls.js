import { esc } from './format.js';
export const field = (name, label, value = '', type = 'text', extra = '') => `<label class="field"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
export const select = (name, label, options, value = '', extra = '') => `<label class="field"><span>${esc(label)}</span><select name="${name}" ${extra}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
export const textarea = (name, label, value = '', extra = '') => `<label class="field full col-span-full"><span>${esc(label)}</span><textarea name="${name}" rows="3" ${extra}>${esc(value)}</textarea></label>`;
