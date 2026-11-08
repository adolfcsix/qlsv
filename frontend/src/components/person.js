import { esc, initials } from './format.js';
export const person = (s, sub = '') => `<div class="person"><span class="avatar">${s.photoUrl && /^\/api\/v1\/students\/\d+\/photo\?v=\d+$/.test(s.photoUrl) ? `<img src="${esc(s.photoUrl)}" alt="" loading="lazy">` : esc(initials(s.name))}</span><div><strong>${esc(s.name)}</strong><small>${esc(sub || s.code || '')}</small></div></div>`;
