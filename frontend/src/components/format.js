export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = v => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
export const date = v => v ? new Date(v.length === 10 ? v + 'T00:00:00' : v).toLocaleDateString('vi-VN') : '—';
export const initials = n => String(n || '').trim().split(/\s+/).slice(-2).map(x => x[0]).join('');
