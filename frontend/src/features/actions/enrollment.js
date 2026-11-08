import { transact, audit, register, isOnline, api, refresh } from '../../services/repository.js';
import * as ui from '../../components/ui.js';
import * as pages from '../../pages/index.js';
const { esc, icon, btn, link, field, select, textarea, badge, person, money, date, modal, info, confirm, toast, csv } = ui;
export function createActions(runtime) {
    const { context, render, toggleMenu, go, getUser, checkAcademic, options, orgForm, studentForm, requestDetail, accountForm, accountDetail, saveGrades, saved, log, filterMemory, state } = runtime;
    return {
        'cancel-enrollment': el => {
            const enrollmentId = el.dataset.id;
            confirm('Hủy đăng ký học phần', 'Hủy đăng ký trong thời hạn. Hệ thống vẫn lưu lịch sử lần đăng ký.', async () => {
                await api(`/enrollments/${encodeURIComponent(enrollmentId)}/cancel`, { method: 'POST', body: {} });
                await refresh();
                await saved('Đã hủy đăng ký và lưu lịch sử.');
            });
        },
        'request-withdrawal': el => {
            const enrollmentId = el.dataset.id;
            modal('Đề nghị rút học phần', textarea('reason', 'Lý do rút học *', '', 'required minlength="10" maxlength="1000"'), async data => {
                await api(`/enrollments/${encodeURIComponent(enrollmentId)}/withdraw-request`, {
                    method: 'POST', body: { reason: data.reason }
                });
                await refresh();
                await saved('Đã gửi yêu cầu, chờ cán bộ đào tạo xét duyệt.');
            });
        },
        cart: async el => {
            const classId = el.dataset.id;
            const index = state.cart.indexOf(classId);
            if (index >= 0) {
                state.cart.splice(index, 1);
                delete state.cartDetails[classId];
            } else {
                // Giữ thông tin lớp lấy từ máy chủ ngay khi chọn; chuyển trang không mất giỏ.
                const row = isOnline() ? await api(`/course-sections/${encodeURIComponent(classId)}`) :
                    context().db.classes.find(item => item.id === classId);
                if (!row) throw new Error('Không tìm thấy lớp học phần.');
                if (row.status !== 'open' || Number(row.count) >= Number(row.capacity))
                    throw new Error('Lớp đã đóng hoặc hết chỗ. Vui lòng tải lại danh sách.');
                state.cart.push(classId);
                state.cartDetails[classId] = row;
            }
            render();
        },
        register: () => { const ctx = context(); confirm('Gửi đăng ký chờ duyệt', `Bạn đang chọn ${state.cart.length} lớp. Cán bộ sẽ xét duyệt; trước khi duyệt bạn chưa được thêm vào lịch học.`, async () => { if (isOnline()) {
            await api('/enrollment-requests', { method: 'POST', body: { studentId: ctx.user.profileId, classIds: state.cart } });
            await refresh();
        }
        else
            await transact(db => { register(db, ctx.user.profileId, state.cart); audit(db, ctx.user.name, 'Đăng ký học phần mẫu', state.cart.join(', ')); }); state.cart = []; state.cartDetails = {}; await saved(isOnline() ? 'Đã gửi đăng ký, chờ cán bộ phê duyệt. Lịch học sẽ xuất hiện sau khi được duyệt.' : 'Đã đăng ký trên dữ liệu minh họa.'); }); }
    };
}
