import { read, upsert, uid, api, isOnline } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
import * as pages from '../../pages/index.js';
import { renderClassSessions } from '../timetable/class-sessions.js';
const { esc, icon, btn, link, field, select, textarea, badge, person, money, date, modal, info, confirm, toast, csv } = ui;
export function createActions(runtime) {
    const { context, render, toggleMenu, go, getUser, checkAcademic, options, orgForm, studentForm, requestDetail, accountForm, accountDetail, saveGrades, saved, log, filterMemory, state } = runtime;
    return {
        'class-detail': async el => {
            const ctx = context();
            const c = isOnline() ? await api(`/course-sections/${encodeURIComponent(el.dataset.id)}`) :
                ctx.db.classes.find(row => row.id === el.dataset.id);
            if (!c) throw new Error('Không tìm thấy lớp học phần.');
            const subject = ctx.db.subjects.find(s => s.id === c.subjectId);
            const title = subject?.name || c.subjectName || c.code;
            info(title, pages.details([
                ['Mã lớp', c.code], ['Giảng viên', c.lecturerName ||
                    ctx.db.lecturers.find(l => l.id === c.lecturerId)?.name || 'Chưa phân công'],
                ['Học kỳ', c.semester], ['Tín chỉ', String(c.credits || subject?.credits || 0)],
                ['Sĩ số', `${c.count} / ${c.capacity}`]
            ]) + `<h3>Lịch học của lớp</h3>${renderClassSessions(c, { details: true })}`);
        }
    };
}
