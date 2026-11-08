import { matches } from '../../../utils/view-model.js';
import { esc, icon, badge, btn, link, empty, card, heading } from '../../../components/ui.js';
import { classInfo, visibleClasses, searchBar, pagination } from '../../_shared.js';
import { renderClassSessions, classSessions } from '../../../features/timetable/class-sessions.js';
import { paginatedRows, resourceNotice } from '../../../services/resource-pages.js';

export function courses(ctx) {
    const { db, user } = ctx;
    const remote = ctx.remoteList;
    const rows = remote ? remote.state === 'ready' ? remote.data.items : [] :
        visibleClasses(ctx).filter(c => matches(`${c.code} ${db.subjects.find(s => s.id === c.subjectId)?.name} ${db.lecturers.find(l => l.id === c.lecturerId)?.name}`, ctx.filters.search));
    const cards = rows.map(row => {
        const c = classInfo(db, row);
        const subject = c.subject || { name: row.subjectName || 'Học phần', credits: row.credits || 0 };
        const teacher = c.lecturer?.name || row.lecturerName || 'Chưa phân công';
        return `<article class="course-card"><div class="course-top"><span class="course-code">${esc(c.code)}</span>${badge(c.status)}</div><div class="course-symbol">${icon('book')}</div><h2>${esc(subject.name)}</h2><p>${esc(teacher)}</p><dl><div><dt>Lịch học · ${classSessions(c).length} buổi</dt><dd>${renderClassSessions(c)}</dd></div><div><dt>Phòng · Tín chỉ</dt><dd>${esc(c.room)} · ${subject.credits} TC</dd></div><div><dt>Sĩ số</dt><dd>${Number(c.count)} / ${Number(c.capacity)}</dd></div></dl><div class="capacity"><span style="width:${Math.min(100, Number(c.count) / Number(c.capacity) * 100)}%"></span></div><div class="course-actions">${btn('Chi tiết lớp ' + icon('arrow'), 'class-detail', '', 'data-id="' + esc(c.id) + '"')}${user.role === 'academic' ? btn('Quản lý & xếp lịch','manage-section','primary','data-id="'+esc(c.id)+'"') : ''}${link('Sổ điểm', `/${user.role}/grades/${c.id}`, 'text-link')}</div></article>`;
    }).join('');
    return heading('TỔ CHỨC GIẢNG DẠY', user.role === 'lecturer' ? 'Lớp giảng dạy' : 'Lớp học phần',
        'Các lớp theo học phần, học kỳ và giảng viên phụ trách.',
        user.role === 'academic' ? btn(icon('plus') + ' Mở lớp học phần', 'new-class', 'primary') :
            link('Lịch giảng dạy', '/lecturer/schedule', 'btn')) +
        searchBar(ctx, 'Tìm lớp, học phần hoặc giảng viên') +
        (remote && remote.state !== 'ready' ? resourceNotice(remote) :
            (rows.length ? `<div class="course-grid">${cards}</div>` :
                card('Kết quả tìm kiếm', '', empty('Không có lớp phù hợp', 'Thử đổi từ khóa hoặc xóa bộ lọc.'))) +
            (remote?.state === 'ready' ? pagination(paginatedRows(remote.data), 'lớp') : ''));
}
