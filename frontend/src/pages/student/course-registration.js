import { matches, termInfo } from '../../utils/view-model.js';
import { getContext, isOnline } from '../../services/repository.js';
import { esc, icon, badge, btn, empty, table, heading } from '../../components/ui.js';
import { classInfo, searchBar, pagination } from '../_shared.js';
import { renderClassSessions, classSessions } from '../../features/timetable/class-sessions.js';
import { paginatedRows, resourceNotice } from '../../services/resource-pages.js';

export function registration(ctx) {
    const { db, user, cart } = ctx;
    const enrollmentResource = ctx.remoteEnrollments;
    const current = enrollmentResource ? enrollmentResource.state === 'ready' ? enrollmentResource.data.items : [] :
        db.enrollments.filter(e => e.studentId === user.profileId &&
            ['studying', 'registered'].includes(e.status));
    // Giỏ giữ bản tóm tắt lớp đã chọn từ API, không phụ thuộc trang snapshot /state.
    const cartDetails = ctx.cartDetails || {};
    const chosen = id => cartDetails[id] || db.classes.find(c => c.id === id);
    const credits = cart.reduce((sum, id) => sum +
        Number(chosen(id)?.credits ?? db.subjects.find(s => s.id === chosen(id)?.subjectId)?.credits ?? 0), 0);
    const remote = ctx.remoteList || null;
    // Online: nguồn danh sách là API có kiểm soát chương trình tại server.
    const available = remote ? remote.state === 'ready' ? remote.data.items : [] :
        db.classes.filter(c => c.status === 'open')
            .filter(c => !db.curriculum || db.curriculum.some(cs =>
                cs.subjectId === c.subjectId && cs.programId ===
                getContext(db, db.students.find(s => s.id === user.profileId)).program?.id))
            .filter(c => matches(`${c.code} ${db.subjects.find(s => s.id === c.subjectId)?.name}`, ctx.filters.search));
    const requestsResource=ctx.remoteRegistrationRequests;
    const requests=requestsResource?.state==='ready'?requestsResource.data.items:[];
    const pending=new Set(requests.filter(r=>r.status==='pending').map(r=>r.classId));
    const rows = available.map(row => {
        const c = classInfo(db, row);
        const subject = c.subject || { name: row.subjectName || 'Học phần', credits: row.credits || 0 };
        const enrolled = current.some(e => e.classId === c.id && ['studying','registered'].includes(e.status));
        const selected = cart.includes(c.id);
        return [
            `<strong>${esc(subject.name)}</strong><small>${esc(c.code)} · ${subject.credits} TC</small>`,
            renderClassSessions(c),
            `${Number(c.count)}/${Number(c.capacity)}`,
            enrolled ? badge('active', 'Đã được duyệt / phân lớp') : pending.has(c.id) ? badge('pending','Chờ cán bộ duyệt') :
                btn(selected ? 'Bỏ chọn' : c.count >= c.capacity ? 'Đã đủ' : '+ Chọn',
                    'cart', selected ? 'selected' : '',
                    'data-id="' + esc(c.id) + '" ' + (c.count >= c.capacity ? 'disabled' : ''))
        ];
    });
    const listing = remote && remote.state !== 'ready' ? resourceNotice(remote) :
        table(['HỌC PHẦN', 'LỊCH HỌC', 'SĨ SỐ', ''], rows) +
        (remote?.state === 'ready' ? pagination(paginatedRows(remote.data), 'lớp') : '');
    const ownRegistrationRows = current.map(e => [
        `<strong>${esc(e.subject || db.subjects.find(s => s.id === db.classes.find(c => c.id === e.classId)?.subjectId)?.name || 'Học phần')}</strong><small>${esc(e.classCode || db.classes.find(c => c.id === e.classId)?.code || '')}</small>`,
        badge(e.status, ({ registered: 'Đã đăng ký', studying: 'Đang học',
            cancelled: 'Đã hủy', withdrawn: 'Đã rút' })[e.status] || e.status),
        !enrollmentResource ? 'Xem trong bản demo' :
            ['cancelled','withdrawn'].includes(e.status) ? 'Đã lưu lịch sử' :
            ['submitted','needs_info','approved'].includes(e.withdrawalStatus) ?
                badge(e.withdrawalStatus, ({ submitted: 'Đang chờ duyệt', needs_info: 'Cần bổ sung',
                    approved: 'Đã duyệt, chờ thực hiện' })[e.withdrawalStatus]) :
            e.canCancel ? btn('Hủy đăng ký', 'cancel-enrollment', 'danger-btn',
                'data-id="' + esc(e.id) + '"') :
                btn('Đề nghị rút học', 'request-withdrawal', '', 'data-id="' + esc(e.id) + '"')
    ]);
    const myEnrollments = enrollmentResource && enrollmentResource.state !== 'ready' ? resourceNotice(enrollmentResource) :
        table(['HỌC PHẦN', 'TRẠNG THÁI', 'THAO TÁC'], ownRegistrationRows);
    const basket = cart.length ? cart.map(id => {
        const row = chosen(id);
        if (!row) return '';
        const c = classInfo(db, row);
        const title = c.subject?.name || c.subjectName || c.code;
        const amount = c.subject?.credits ?? c.credits ?? 0;
        return `<div class="cart-item"><div><strong>${esc(title)}</strong>` +
            `<small>${esc(c.code)} · ${amount} TC · ${classSessions(c).length} buổi học</small>` +
            `${renderClassSessions(c)}</div>${btn(icon('close'), 'cart', 'icon-btn',
                'data-id="' + esc(id) + '" aria-label="Bỏ học phần"')}</div>`;
    }).join('') : empty('Chưa chọn lớp', 'Chọn học phần ở bảng bên cạnh.');
    const requestNames={pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Từ chối',cancelled:'Đã rút'};
    const requestListing=requestsResource?.state==='ready'?table(['LỚP HỌC PHẦN','TRẠNG THÁI','Ý KIẾN CÁN BỘ',''],requests.map(r=>[esc(r.classCode)+'<small>'+esc(r.subject)+'</small>',badge(r.status,requestNames[r.status]),esc(r.reason||'—'),r.status==='pending'?btn('Rút yêu cầu','cancel-registration-request','small','data-id="'+esc(r.id)+'"'):'—'])):resourceNotice(requestsResource||{state:'loading'});
    return heading('KẾ HOẠCH HỌC TẬP', 'Đăng ký học phần',
        'Chọn lớp, gửi đăng ký và chờ cán bộ phê duyệt. Chỉ lớp đã được duyệt mới có trong lịch học.',
        badge('open', (isOnline() || enrollmentResource) ? 'Kiểm tra điều kiện tại máy chủ' : 'Đăng ký trên dữ liệu mẫu')) +
        `<ol class="stepper"><li class="active"><span>1</span>Chọn lớp học phần</li><li class="${cart.length ? 'active' : ''}"><span>2</span>Kiểm tra danh sách</li><li><span>3</span>Xác nhận đăng ký</li></ol>` +
        `<div class="notice">${icon('shield')}<p>${isOnline() || enrollmentResource ?
            'Máy chủ kiểm tra chương trình, thời hạn, điều kiện học tập, lịch và sĩ số.' :
            'Bạn đang thử đăng ký trên dữ liệu mẫu.'}</p></div>` +
        `<div class="two-cols main-side"><section class="card"><div class="card-head"><div><h2>Các lớp đang mở</h2><p>${esc(termInfo(db).name)} · ${esc(termInfo(db).year)}</p></div></div>` +
        searchBar(ctx, 'Tìm học phần đang mở') + listing +
        `</section><aside class="card cart"><div class="card-head"><div><h2>Danh sách của bạn</h2><p>${cart.length} lớp đã chọn</p></div></div><div class="pad">` +
        basket + `<div class="cart-total"><span>Tổng tín chỉ</span><strong>${credits} TC</strong></div>` +
        btn('Gửi đăng ký chờ duyệt ' + icon('arrow'), 'register', 'primary block', !cart.length ? 'disabled' : '') +
        '</div></aside></div>' +
        `<section class="card"><div class="card-head"><div><h2>Đăng ký của tôi · chờ duyệt & kết quả</h2><p>Yêu cầu chưa duyệt không chiếm chỗ và chưa tạo lịch học.</p></div></div>${requestListing}${requestsResource?.state==='ready'&&requestsResource.data.pagination.pages>1?'<div class="table-foot"><span>Trang '+requestsResource.data.pagination.page+'/'+requestsResource.data.pagination.pages+'</span><div>'+btn('Trước','request-page','','data-page="'+(requestsResource.data.pagination.page-1)+'" '+(requestsResource.data.pagination.page<=1?'disabled':''))+btn('Sau','request-page','','data-page="'+(requestsResource.data.pagination.page+1)+'" '+(requestsResource.data.pagination.page>=requestsResource.data.pagination.pages?'disabled':''))+'</div></div>':''}</section>` +
        `<section class="card"><div class="card-head"><div><h2>Học phần của tôi</h2><p>Hủy trong thời hạn; ngoài thời hạn cần gửi yêu cầu học vụ.</p></div></div>${myEnrollments}</section>`;
}
