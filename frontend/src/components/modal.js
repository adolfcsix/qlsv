import { isOnline } from '../services/repository.js';
import { esc } from './format.js';
import { btn } from './buttons.js';
import { icon } from './icon.js';
let dialogReturn;
export function modal(title, body, onSubmit, wide = false) { const el = document.querySelector('#modal'); dialogReturn = document.activeElement; el.innerHTML = `<form id="dialog-form"><div class="dialog-head"><div><p class="eyebrow">LAC HONG UNIVERSITY / THAO TÁC</p><h2 id="dialog-title">${esc(title)}</h2></div>${btn(icon('close'), 'close', 'icon-btn', 'aria-label="Đóng hộp thoại"')}</div><div class="dialog-body">${body}<p class="form-error" role="alert" hidden></p></div><div class="dialog-foot"><span class="muted">${isOnline() ? 'Dữ liệu lưu tại máy chủ' : 'Dữ liệu minh họa trên trình duyệt'}</span><div>${btn('Hủy', 'close')}<button class="btn primary" type="submit">Lưu thay đổi</button></div></div></form>`; el.className = wide ? 'wide' : ''; el.setAttribute('aria-labelledby', 'dialog-title'); el.showModal(); let pending = false; el.oncancel = e => { if (pending)
    e.preventDefault(); }; el.querySelectorAll('[data-action="close"]').forEach(b => b.onclick = () => el.close()); el.querySelector('form').onsubmit = async (e) => { e.preventDefault(); const error = el.querySelector('.form-error'); const submit = el.querySelector('[type=submit]'); if (pending)
    return; pending = true; if (submit)
    submit.disabled = true; el.querySelectorAll('[data-action=close]').forEach(b => b.disabled = true); try {
    await onSubmit(Object.fromEntries(new FormData(e.target)));
    el.close();
}
catch (err) {
    error.textContent = err.message;
    error.hidden = false;
}
finally {
    pending = false;
    if (submit)
        submit.disabled = false;
    el.querySelectorAll('[data-action=close]').forEach(b => b.disabled = false);
} }; el.onclose = () => dialogReturn?.focus(); }
export function info(title, body) { modal(title, body, () => { }); document.querySelector('#modal [type="submit"]').remove(); document.querySelector('#modal .dialog-foot [data-action=close]').textContent = 'Đóng'; }
export function confirm(title, desc, callback) { modal(title, `<p>${esc(desc)}</p>`, callback); const b = document.querySelector('#modal [type="submit"]'); b.textContent = 'Xác nhận'; b.classList.add('danger-btn'); }
