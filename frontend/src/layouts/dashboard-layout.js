import { roles } from '../demo/data.js';
import { isOnline } from '../services/repository.js';
import { renderSidebar } from '../components/sidebar.js';
import { renderTopbar } from '../components/topbar.js';
// Khung trang giữ nguyên cho bốn vai trò. Các mục menu do navigation.js quyết định.
export function buildDashboardLayout({ u, page, label, personal, term, logo, navLink }) {
    return `<div class="app-shell role-${u.role}">
    ${renderSidebar({ user: u, logo, personal, navLink })}
    <div class="workspace">
      ${renderTopbar({ user: u, label, term })}
      <main id="main" tabindex="-1">
        ${!isOnline() ? '<div class="environment-label"><i></i> Bản trải nghiệm · dữ liệu mẫu trên trình duyệt</div>' : ''}
        ${page}
        <footer class="page-footer">
          <span>LAC HONG UNIVERSITY <i>/</i> ${roles[u.role]}</span>
          <span>${isOnline() ? 'Đã kết nối máy chủ' : 'Chế độ trình diễn'}</span>
        </footer>
      </main>
    </div>
  </div>`;
}
