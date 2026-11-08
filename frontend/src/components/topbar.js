import { isOnline } from '../services/repository.js';
import { brandMark } from './brand.js';
import { esc, icon, btn, initials } from './ui.js';
export function renderTopbar({ user, label, term }) {
    return `<header class="topbar">
    ${btn(icon('menu'), 'menu', 'icon-btn menu-button', 'aria-label="Mở menu" aria-expanded="false"')}
    <div class="breadcrumb">Lac Hong <span>/</span> <strong>${esc(label)}</strong></div>
    <div class="topbar-right">
      <span class="term-label">${esc(term.name)} · ${esc(term.year)}</span>
      ${isOnline() ? btn(icon('clock'), 'refresh-data', 'icon-btn', 'aria-label="Cập nhật dữ liệu" title="Cập nhật dữ liệu"') : ''}
      ${btn(brandMark(), 'open-chat', 'icon-btn mobile-chat-button', 'aria-label="Mở chatbot Lac Hong" title="Mở chatbot Lac Hong"')}
      ${btn(icon('bell'), 'notifications', 'icon-btn', 'aria-label="Công việc cần theo dõi" title="Công việc cần theo dõi"')}
      <span class="top-avatar" aria-hidden="true">${initials(user.name)}</span>
    </div>
  </header>`;
}
