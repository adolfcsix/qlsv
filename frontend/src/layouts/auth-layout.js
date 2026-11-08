import { roles } from '../demo/data.js';
import { read, remove, isOnline, signIn, backendInfo } from '../services/repository.js';
import * as ui from '../components/ui.js';
import * as pages from '../pages/index.js';
import { resetAssistant } from '../features/chatbot/chat-widget.js';
const { esc, icon, btn, link, field, select, textarea, badge, person, money, date, modal, info, confirm, toast, csv } = ui;
export function mountLogin({ app, logo, go, state }) {
    resetAssistant();
    const db = read();
    app.innerHTML = `<main class="login-shell" id="main"><section class="login-art"><a class="brand" href="#/login">${logo()}</a><div class="login-story"><p class="eyebrow">CỔNG THÔNG TIN ĐÀO TẠO</p><h1>Cổng thông tin<br>đại học.</h1><p>Tra cứu học tập, quản lý hồ sơ<br>và xử lý nghiệp vụ đào tạo.</p><img class="campus-portal" src="./assets/brand/campus-portal.svg" alt="" width="660" height="490" decoding="async"></div><div class="art-footer"><span>LAC HONG UNIVERSITY / UNIVERSITY MANAGEMENT</span><span>2026 — 2027</span></div></section><section class="login-form-side"><div class="login-form-wrap"><span class="demo-pill"><i></i> Bản trải nghiệm · Dữ liệu minh họa</span><p class="eyebrow">CHÀO MỪNG TRỞ LẠI</p><h2>Đăng nhập Lac Hong</h2><p class="lead">Sử dụng tài khoản được nhà trường cấp.</p><form id="login-form">${field('username', 'Tên đăng nhập hoặc email *', '', 'text', 'required autocomplete="username" placeholder="Nhập tên đăng nhập hoặc email"')}<div class="password-wrap">${field('password', 'Mật khẩu *', '', 'password', 'required autocomplete="current-password" placeholder="Nhập mật khẩu"')}${btn('Hiện', 'toggle-password', 'password-toggle')}</div><div class="login-options"><span>${icon('shield')} Tài khoản do quản trị cấp</span>${btn('Cần hỗ trợ?', 'support', 'text-button')}</div><p class="form-error" role="alert" ${state.loginHint ? '' : 'hidden'}>${esc(state.loginHint)}</p><button type="submit" class="btn primary block large">Đăng nhập ${icon('arrow')}</button></form><div class="demo-accounts"><div class="section-line"><span>CHỌN VAI TRÒ ĐỂ TRẢI NGHIỆM</span></div><div class="role-grid">${Object.entries(roles).map(([role, label]) => btn(icon({ sysadmin: 'shield', academic: 'layers', lecturer: 'book', student: 'cap' }[role]) + label, 'demo-account', '', 'data-role="' + role + '"')).join('')}</div><p>Chỉ dùng tài khoản giả. Mật khẩu mẫu: <code>Hocvu@2026</code></p></div><p class="login-bottom">Không có đăng ký tự do. Chưa nhận tài khoản?<br>Liên hệ đơn vị quản lý hồ sơ để được hỗ trợ.</p></div><footer>LAC HONG UNIVERSITY <span>·</span> Hệ thống quản lý đại học</footer></section></main>`;
    if (isOnline()) {
        app.querySelector('.demo-pill').textContent = 'Hệ thống có kết nối máy chủ';
        if (backendInfo()?.mode !== 'demo')
            app.querySelector('.demo-accounts').remove();
        app.querySelectorAll('.field input[type=password]').forEach(x => x.maxLength = 128);
    }
    app.querySelector('#login-form').onsubmit = async (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); if (isOnline()) {
        const error = e.target.querySelector('.form-error');
        const button = e.target.querySelector('[type=submit]');
        button.disabled = true;
        try {
            const a = await signIn(data.username, data.password);
            go(`/${a.role}/${a.mustChange ? 'password' : 'dashboard'}`);
        }
        catch (err) {
            error.textContent = err.message;
            error.hidden = false;
        }
        finally {
            button.disabled = false;
        }
        return;
    } const a = db.accounts.find(a => a.code.toLowerCase() === data.username.trim().toLowerCase() || a.email.toLowerCase() === data.username.trim().toLowerCase()); const fail = message => { const el = e.target.querySelector('.form-error'); el.textContent = message; el.hidden = false; }; if (!a || data.password !== 'Hocvu@2026')
        return fail('Thông tin chưa đúng. Chọn vai trò mẫu và dùng mật khẩu Hocvu@2026.'); if (a.status === 'locked')
        return fail('Tài khoản đang bị khóa. Liên hệ quản trị để được hỗ trợ.'); sessionStorage.setItem('hocvu-account', a.id); go(`/${a.role}/${a.mustChange ? 'password' : 'dashboard'}`); };
}
