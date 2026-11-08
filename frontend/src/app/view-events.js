// Sự kiện riêng của từng màn hình, gắn lại sau khi render.
import { isOnline, api, signOut, transact, audit } from '../services/repository.js';
import { gradeMeta, gradeTotal } from '../utils/view-model.js';
import { visibleClasses } from '../pages/_shared.js';
import { toast } from '../components/toast.js';

let searchDebounce = null;
const dependentFilters = {
    overviewKind: ['overviewIssue'],
    overviewCohort: ['overviewGroup'],
    overviewDepartment: ['overviewMajor','overviewGroup'],
    overviewMajor: ['overviewGroup'],
    scheduleCohort: ['scheduleClass','scheduleGroup'],
    scheduleDepartment: ['scheduleMajor','scheduleGroup','scheduleClass'],
    scheduleMajor: ['scheduleGroup','scheduleClass'],
    scheduleGroup: ['scheduleClass'],
    requestStatus: ['requestPage'],
    curriculumProgramId: ['curriculumStudentId'],
    cohort: ['program', 'group'],
    department: ['major', 'program', 'group'],
    major: ['program', 'group'],
    program: ['group']
};

function bindFilters(app, state, render) {
    for (const element of app.querySelectorAll('[data-filter]')) {
        const update = () => {
            if (state.dirtyGrades) {
                element.value = state.filters[element.dataset.filter] || '';
                toast('Hãy lưu điểm trước khi đổi bộ lọc.', true);
                return;
            }

            const key = element.dataset.filter;
            const caret = element.selectionStart;
            state.filters[key] = element.value;
            for (const child of dependentFilters[key] || []) delete state.filters[child];
            state.filters.page = 1;
            // Search on the server after a short typing pause, not on every keypress.
            clearTimeout(searchDebounce);
            if (key === 'search' && isOnline()) {
                searchDebounce = setTimeout(() => { searchDebounce = null; render(); }, 250);
                return;
            }
            if (key.startsWith('schedule') && location.hash.startsWith('#/academic/schedule/'))
                history.replaceState(null,'','#/academic/schedule');
            render();

            const next = app.querySelector(`[data-filter="${key}"]`);
            next?.focus();
            if (['text','search'].includes(next?.type)) next.setSelectionRange(caret, caret);
        };
        element.addEventListener(element.tagName === 'SELECT' ? 'change' : 'input', update);
    }
}

function bindGrades(ctx, app, state, go) {
    const selectedClass = app.querySelector('#grade-class');
    if (selectedClass) selectedClass.onchange = () => {
        if (state.dirtyGrades && !window.confirm('Điểm chưa lưu sẽ bị bỏ. Tiếp tục chuyển lớp?')) {
            selectedClass.value = ctx.parts[2] || visibleClasses(ctx)[0]?.id;
            return;
        }
        state.dirtyGrades = false;
        go(`/${ctx.user.role}/grades/${selectedClass.value}`);
    };

    for (const element of app.querySelectorAll('.grade-input')) element.oninput = () => {
        state.dirtyGrades = true;
        app.querySelector('#grade-hint').textContent = 'Có thay đổi chưa được lưu';
        const id = element.name.split('_')[0];
        const grade = ctx.remoteGradebook?.state === 'ready' ? ctx.remoteGradebook.data.items.find(row => row.id === id) : ctx.db.grades.find(row => row.id === id);
        if (!grade) return;
        const process = app.querySelector(`[name="${id}_process"]`).value;
        const midterm = app.querySelector(`[name="${id}_midterm"]`).value;
        const total = gradeTotal({
            ...grade,
            process: process === '' ? null : Number(process),
            midterm: midterm === '' ? null : Number(midterm)
        }, ctx.remoteGradebook?.state === 'ready' ? ctx.remoteGradebook.data.meta : gradeMeta(ctx.db, grade.classId));
        app.querySelector(`[data-total="${id}"]`).textContent = total === null ? '—' : total.toFixed(2);
    };
}

function bindSecurity(ctx, app, go) {
    const show = app.querySelector('#show-passwords');
    if (show) show.onchange = () => {
        for (const field of app.querySelectorAll('#password-form input[name]')) {
            field.type = show.checked ? 'text' : 'password';
        }
    };

    const form = app.querySelector('#password-form');
    if (!form) return;
    form.onsubmit = async event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form));
        const error = form.querySelector('.form-error');
        const submit = form.querySelector('[type=submit]');
        error.hidden = true;
        submit.disabled = true;

        if (isOnline()) {
            try {
                if (values.password !== values.confirm) throw new Error('Nhập lại mật khẩu chưa khớp.');
                await api('/auth/password', {
                    method: 'POST',
                    body: { current: values.current, password: values.password }
                });
                await signOut().catch(() => {});
                toast('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
                go('/login');
            } catch (cause) {
                error.textContent = cause.message;
                error.hidden = false;
            } finally {
                submit.disabled = false;
            }
            return;
        }

        // Đây chỉ là luồng demo ở localStorage; môi trường thật phải gọi API.
        submit.disabled = false;
        if (values.current !== 'Hocvu@2026' || values.password.length < 10 ||
            values.password !== values.confirm || values.password === values.current) {
            error.textContent = 'Kiểm tra mật khẩu hiện tại (Hocvu@2026), mật khẩu mới và xác nhận. Mật khẩu mới cần khác mật khẩu hiện tại.';
            error.hidden = false;
            return;
        }
        await transact(db => {
            db.accounts.find(account => account.id === ctx.user.id).mustChange = false;
            audit(db, ctx.user.name, 'Hoàn tất đổi mật khẩu mẫu', ctx.user.code);
        });
        toast('Đã hoàn tất bước đổi mật khẩu minh họa. Đăng nhập mẫu vẫn dùng Hocvu@2026.');
        go(`/${ctx.user.role}/dashboard`);
    };
}

export function bindView(ctx, { app, state, render, go }) {
    bindFilters(app, state, render);
    bindGrades(ctx, app, state, go);
    bindSecurity(ctx, app, go);
}
