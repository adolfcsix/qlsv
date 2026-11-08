import { roles } from '../demo/data.js';
import { navigation, personalRoute } from '../app/navigation.js';
import { icon, btn, link, person } from './ui.js';
export function renderSidebar({ user, logo, personal, navLink }) {
    return `<button type="button" class="sidebar-backdrop" data-action="menu" aria-label="Đóng menu"></button>
    <aside class="sidebar">
      <a class="brand" href="#/${user.role}/dashboard">${logo()}</a>
      ${btn(icon('close'), 'menu', 'icon-btn sidebar-close', 'aria-label="Đóng menu"')}
      <div class="workspace-label">${roles[user.role]}</div>
      <nav aria-label="Điều hướng chính">
        ${navigation[user.role].map(([key, title, symbol]) => navLink(user, key, title, symbol)).join('')}
      </nav>
      <div class="sidebar-bottom">
        <div class="sidebar-rule"></div>
        ${link(icon('settings') + '<span>Hồ sơ & bảo mật</span>', personalRoute(user), 'nav-link ' + (personal ? 'active' : ''))}
        <div class="sidebar-person">${person(user, roles[user.role])}
          ${btn(icon('logout'), 'logout', 'icon-btn', 'aria-label="Đăng xuất" title="Đăng xuất"')}
        </div>
      </div>
    </aside>`;
}
