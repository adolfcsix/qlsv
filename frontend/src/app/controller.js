import { buildDashboardLayout } from '../layouts/dashboard-layout.js';
import { canOpenView } from './auth-guard.js';
import { go, routeParts } from './router.js';
import { getUser } from './session.js';
import { mountLogin } from '../layouts/auth-layout.js';
import { createForms } from '../features/forms.js';
import { createActions } from '../features/actions/index.js';
import { brandWordmark } from '../components/brand.js';
import { read, transact, audit, api, isOnline, initialize, refresh } from '../services/repository.js';
import { createResourcePages } from '../services/resource-pages.js';
import { getLookupOptions, clearLookupCache } from '../services/lookup-service.js';
import * as ui from '../components/ui.js';
import { renderers } from './routes.js';
import { mountChatbot, openAssistant, resetAssistant } from '../features/chatbot/chat-widget.js';
import { navigation, securityRoute, canonicalRoute } from './navigation.js';
import { termInfo } from '../utils/view-model.js';
import { visibleClasses } from '../pages/_shared.js';
import { bindView } from './view-events.js';
const { icon, btn, link, toast } = ui;
const app = document.querySelector('#app');
const state = { filters: {}, cart: [], cartDetails: {}, dirtyGrades: false, lastRoute: '', loginHint: '', pendingChat: false };
const filterMemory = new Map();
let menuReturn = null;
let lastRemoteUser = null;
// A late request must not replace grade inputs while the user is editing.
const remotePages = createResourcePages(path => api(path), () => { if (!state.dirtyGrades) render(); });
let renderedContext = null;
function baseContext() { const parts = routeParts(); return { db: read(), user: getUser(), parts, filters: state.filters, cart: state.cart, cartDetails: state.cartDetails }; }
function context() {
    const current = baseContext();
    return renderedContext?.user?.id === current.user?.id &&
        renderedContext.parts.join('/') === current.parts.join('/') ?
        { ...renderedContext, ...current } : current;
}
function logo() { return brandWordmark(); }
function toggleMenu(force) { const open = force ?? !document.body.classList.contains('menu-open'); if (open)
    menuReturn = document.activeElement; document.body.classList.toggle('menu-open', open); const sidebar = app.querySelector('.sidebar'), workspace = app.querySelector('.workspace'); if (workspace)
    workspace.inert = open; app.querySelector('.menu-button')?.setAttribute('aria-expanded', String(open)); if (sidebar) {
    if (open) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
        sidebar.setAttribute('aria-label', 'Điều hướng ứng dụng');
        sidebar.querySelector('.sidebar-close')?.focus();
    }
    else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
        sidebar.removeAttribute('aria-label');
        menuReturn?.focus();
    }
} }
function navLink(user, key, title, i) { let route = `/${user.role}/${key}`; if (key === 'profile')
    route += `/${user.profileId}/overview`; const active = context().parts[1] === key || key === 'students' && context().parts[1] === 'profile' && user.role === 'academic'; return link(`${icon(i)}<span>${title}</span>${active ? '<i class="nav-dot"></i>' : ''}`, route, `nav-link ${active ? 'active' : ''}`); }
function render() {
    const ctx = baseContext(), u = ctx.user;
    renderedContext = null;
    if ((u?.id || null) !== lastRemoteUser) {
        remotePages.clear();
        clearLookupCache();
        state.cart = [];
        state.cartDetails = {};
        lastRemoteUser = u?.id || null;
    }
    if (!u || ctx.parts[0] === 'login') {
        if (!u && ctx.parts[0] !== 'login')
            history.replaceState(null, '', '#/login');
        mountLogin({ app, logo, go, state });
        return;
    }
    if (u.status !== 'active') {
        resetAssistant();
        sessionStorage.removeItem('hocvu-account');
        state.loginHint = 'Tài khoản đã bị khóa.';
        go('/login');
        return;
    }
    if (ctx.parts[0] !== u.role) {
        go(`/${u.role}/dashboard`);
        return;
    }
    const alias = canonicalRoute(u, ctx.parts);
    if (alias) {
        go(alias);
        return;
    }
    if (u.mustChange && location.hash !== '#' + securityRoute(u)) {
        go(securityRoute(u));
        return;
    }
    const view = ctx.parts[1] || 'dashboard';
    if (view === 'assistant') {
        state.pendingChat = true;
        go(`/${u.role}/dashboard`);
        return;
    }
    if (view === 'students' && ['cohort', 'major', 'status'].includes(ctx.parts[2]) && ctx.parts[3] && !ctx.filters[ctx.parts[2]])
        ctx.filters[ctx.parts[2]] = ctx.parts[3];
    if (isOnline() && u.role === 'sysadmin') {
        if(view==='dashboard') ctx.remoteAdminOverview=remotePages.get('admin-overview',ctx.filters,ctx.db);
        if(view==='personnel') ctx.remoteAdminPersonnel=remotePages.get('admin-personnel',{...ctx.filters,type:ctx.parts[2]==='staff'?'staff':'lecturer'},ctx.db);
        if(view==='calendar') ctx.remoteAdminCalendar=remotePages.get('admin-calendar',ctx.filters,ctx.db);
        if(view==='rooms') ctx.remoteAdminRooms=remotePages.get('admin-rooms',ctx.filters,ctx.db);
    }
    const orgTabs = new Set(['cohorts', 'departments', 'majors', 'programs', 'groups']);
    const orgTab = ctx.parts[2] || 'groups';
    const remoteKind = isOnline() && u.role === 'academic' && view === 'organization' &&
        orgTabs.has(orgTab) ? orgTab :
        isOnline() && ['academic', 'lecturer'].includes(u.role) &&
        (view === 'students' || view === 'advisor') ? 'students' :
        isOnline() && view === 'courses' && ['academic', 'lecturer'].includes(u.role) ? 'course-sections' :
        isOnline() && view === 'registration' && u.role === 'student' ? 'registration-sections' : null;
    if (remoteKind) ctx.remoteList = remotePages.get(remoteKind, ctx.filters, ctx.db);
    if (isOnline() && view === 'registration' && u.role === 'student')
        ctx.remoteEnrollments = remotePages.get('my-enrollments', ctx.filters, ctx.db);
    if (isOnline() && view === 'schedule' && u.role === 'academic') {
        ctx.remoteStaffScheduling = remotePages.get('staff-scheduling', { ...ctx.filters, classId:ctx.parts[2] || ctx.filters.scheduleClass || '' }, ctx.db);
        ctx.remoteRegistrationRequests = remotePages.get('registration-requests', { ...ctx.filters, requestStatus:ctx.filters.requestStatus || 'pending' }, ctx.db);
    }
    if (isOnline() && view === 'registration' && u.role === 'student')
        ctx.remoteRegistrationRequests = remotePages.get('registration-requests', ctx.filters, ctx.db);
    if (isOnline() && view === 'schedule' && ['student', 'lecturer'].includes(u.role))
        ctx.remoteSchedule = remotePages.get('timetable', ctx.filters, ctx.db);
    if (isOnline() && view === 'curriculum' && u.role === 'academic') {
        ctx.curriculumId = ctx.filters.curriculumProgramId || ctx.db.programs[0]?.id || '';
        if (ctx.curriculumId) {
            ctx.remoteCurriculumPlan = remotePages.get('curriculum-plan', { curriculumId: ctx.curriculumId }, ctx.db);
            ctx.remoteCurriculumVersions = remotePages.get('curriculum-versions', { curriculumId: ctx.curriculumId }, ctx.db);
        }
        if (ctx.filters.curriculumStudentId)
            ctx.remoteCurriculumProgress = remotePages.get('curriculum-progress', {studentId:ctx.filters.curriculumStudentId}, ctx.db);
    }
    if (isOnline() && view === 'plan' && u.role === 'student') {
        ctx.remoteCurriculumProgress = remotePages.get('curriculum-progress', {}, ctx.db);
        ctx.remoteGraduationReviews = remotePages.get('graduation-reviews', {}, ctx.db);
    }
    if (isOnline() && view === 'graduation' && u.role === 'academic') {
        ctx.graduationStudentId = ctx.filters.graduationStudentId || ctx.db.students[0]?.id || '';
        if (ctx.graduationStudentId) {
            const studentId = ctx.graduationStudentId;
            ctx.remoteCurriculumProgress = remotePages.get('curriculum-progress', {studentId}, ctx.db);
            ctx.remoteGraduationReviews = remotePages.get('graduation-reviews', {studentId}, ctx.db);
            ctx.remoteCreditRecognitions = remotePages.get('credit-recognitions', {studentId}, ctx.db);
            ctx.remoteRecognitionCandidates = remotePages.get('recognition-candidates', {studentId}, ctx.db);
        }
    }
    if (isOnline() && view === 'semester' && u.role === 'academic') {
        ctx.remoteSemesters=remotePages.get('academic-semesters',{},ctx.db);
        ctx.summaryStudentId=ctx.filters.summaryStudentId || ctx.db.students[0]?.id || '';
        ctx.summarySemesterId=ctx.filters.summarySemesterId || '';
        if (ctx.summaryStudentId) {
            ctx.remoteSummaries=remotePages.get('semester-summaries',{studentId:ctx.summaryStudentId},ctx.db);
            ctx.remoteWarnings=remotePages.get('academic-warnings',{studentId:ctx.summaryStudentId},ctx.db);
            if(ctx.summarySemesterId) ctx.remoteSummaryPreview=remotePages.get('summary-preview',{studentId:ctx.summaryStudentId,semesterId:ctx.summarySemesterId},ctx.db);
        }
    }
    if (isOnline() && view === 'results' && u.role === 'student') {
        ctx.remoteSummaries=remotePages.get('semester-summaries',{studentId:u.profileId},ctx.db);
        ctx.remoteWarnings=remotePages.get('academic-warnings',{studentId:u.profileId},ctx.db);
    }
    if (isOnline() && view === 'grades' && ['academic','lecturer'].includes(u.role)) {
        const selectedId = visibleClasses(ctx).find(c => c.id === ctx.parts[2])?.id || visibleClasses(ctx)[0]?.id;
        if (selectedId) {
            ctx.remoteGradebook = remotePages.get('gradebook', { classId: selectedId }, ctx.db);
            ctx.remoteGradeChanges = remotePages.get('grade-changes', { classId: selectedId }, ctx.db);
        }
    }
    const page = canOpenView(u, view) && renderers[view] ? renderers[view](ctx) : ui.empty('Không tìm thấy trang', 'Trang không tồn tại hoặc không thuộc vai trò của bạn.', link('Về tổng quan', `/${u.role}/dashboard`, 'btn primary'));
    const personal = view === 'account' || u.role === 'student' && view === 'profile';
    const label = personal ? 'Hồ sơ & bảo mật' : navigation[u.role].find(x => x[0] === view)?.[1] || { profile: 'Hồ sơ sinh viên', group: 'Lớp hành chính' }[view] || 'Trang không tồn tại';
    const term = termInfo(ctx.db);
    app.innerHTML = buildDashboardLayout({ u, page, label, personal, term, logo, navLink });
    renderedContext = ctx;
    bindView(ctx, { app, state, render, go });
    if (!u.mustChange) {
        mountChatbot(ctx);
        if (state.pendingChat) {
            state.pendingChat = false;
            openAssistant();
        }
    }
    else
        resetAssistant();
}
function options(table, placeholder, filters) { return getLookupOptions(table, placeholder, filters); }
function checkAcademic() { if (getUser()?.role !== 'academic')
    throw new Error('Thao tác này dành cho cán bộ đào tạo.'); }
async function log(action, detail) { if (isOnline())
    return; await transact(db => audit(db, getUser().name, action, detail)); }
async function saved(message = isOnline() ? 'Đã lưu dữ liệu tại máy chủ.' : 'Đã lưu dữ liệu minh họa.') {
    if (isOnline()) await refresh();
    state.filters.page = 1;
    remotePages.clear(); clearLookupCache(); render(); toast(message);
}
const { orgForm, studentForm, requestDetail, accountForm, accountDetail, saveGrades } = createForms({ context, checkAcademic, options, log, saved, getUser, render, state });
const actions = createActions({ context, render, toggleMenu, go, getUser, checkAcademic, options, orgForm, studentForm, requestDetail, accountForm, accountDetail, saveGrades, saved, log, filterMemory, state });
actions['retry-resource'] = () => { remotePages.clear(); render(); };
const refreshAction = actions['refresh-data'];
actions['refresh-data'] = async () => { await refreshAction(); remotePages.clear(); render(); };
document.addEventListener('click', async (e) => { const el = e.target.closest('[data-action]'); if (!el || el.disabled)
    return; const fn = actions[el.dataset.action]; if (!fn)
    return; el.disabled = true; try {
    await fn(el);
}
catch (err) {
    toast(err.message, true);
}
finally {
    if (el.isConnected)
        el.disabled = false;
} });
document.addEventListener('click', e => { if (e.target.closest('.skip-link')) {
    e.preventDefault();
    document.querySelector('#main')?.focus();
    return;
} const a = e.target.closest('a[href^="#/"]'); if (a?.closest('dialog'))
    document.querySelector('#modal')?.close(); if (a && state.dirtyGrades) {
    if (!window.confirm('Điểm chưa lưu sẽ bị bỏ. Tiếp tục?'))
        e.preventDefault();
    else
        state.dirtyGrades = false;
} });
window.addEventListener('beforeunload', e => { if (state.dirtyGrades) {
    e.preventDefault();
    e.returnValue = '';
} });
window.addEventListener('hashchange', () => { const route = location.hash; if (route !== state.lastRoute) {
    if (state.lastRoute)
        filterMemory.set(state.lastRoute, { ...state.filters });
    state.filters = { ...(filterMemory.get(route) || {}) };
    state.lastRoute = route;
    document.body.classList.remove('menu-open');
} render(); window.scrollTo({ top: 0, behavior: 'instant' }); document.querySelector('#main')?.focus({ preventScroll: true }); });
window.addEventListener('storage', e => { if (e.key === 'hocvu-demo-v1')
    location.reload(); });
window.addEventListener('api-session-expired', () => { clearLookupCache(); document.querySelector('#modal')?.close(); resetAssistant(); filterMemory.clear(); go('/login'); });
try {
    await initialize();
}
catch (err) {
    app.innerHTML = `<main class="boot-error"><div class="card pad">${ui.empty('Chưa kết nối được hệ thống', err.message, btn('Thử kết nối lại', 'reload-app', 'primary'))}</div></main>`;
}
if (!app.querySelector('.boot-error')) {
    if (!location.hash)
        go(getUser() ? `/${getUser().role}/dashboard` : '/login');
    else
        render();
}
document.addEventListener('keydown', e => { if (!document.body.classList.contains('menu-open') || document.querySelector('#modal[open]'))
    return; if (e.key === 'Escape') {
    e.preventDefault();
    toggleMenu(false);
    return;
} if (e.key === 'Tab') {
    const nodes = [...app.querySelectorAll('.sidebar a[href],.sidebar button:not([disabled])')].filter(n => n.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
    }
    else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
    }
} });
window.matchMedia('(max-width:760px)').addEventListener('change', e => { if (!e.matches && document.body.classList.contains('menu-open'))
    toggleMenu(false); });

window.addEventListener('lhu-ai-changed',async()=>{remotePages.clear();if(!state.dirtyGrades){await refresh();render();}else toast('Tác vụ AI đã lưu. Hãy hoàn tất điểm đang nhập rồi cập nhật dữ liệu.');});
