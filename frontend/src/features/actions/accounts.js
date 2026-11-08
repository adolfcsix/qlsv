import { api, isOnline } from '../../services/repository.js';
import { modal, textarea, field, esc } from '../../components/ui.js';
export function createActions({context,accountForm,accountDetail,saved}) {
    function current(el){const ctx=context();if(ctx.user.role!=='sysadmin')throw new Error('Chỉ quản trị quản lý tài khoản.');if(!isOnline())throw new Error('Chạy bản full-stack để quản lý tài khoản.');const account=ctx.db.accounts.find(a=>a.id===el.dataset.id);if(!account)throw new Error('Không tìm thấy tài khoản.');return {ctx,account};}
    return {
        'new-account':el=>accountForm(el.dataset.profile||''),
        'edit-account':el=>accountForm('',el.dataset.id),
        'account-detail':el=>accountDetail(el.dataset.id),
        'lock-account':el=>{const {ctx,account}=current(el);modal(account.status==='active'?'Khóa tài khoản':'Mở khóa tài khoản',textarea('reason','Lý do *','','required maxlength="1000"'),async body=>{await api('/admin/accounts/'+account.id,{method:'PATCH',body:{...body,revision:ctx.db.revision,status:account.status==='active'?'locked':'active'}});await saved('Đã cập nhật trạng thái và thu hồi phiên cũ.');});},
        'reset-password':el=>{const {ctx,account}=current(el);modal('Đặt lại mật khẩu',field('temporaryPassword','Mật khẩu tạm mới *','','password','required minlength="10" maxlength="128" autocomplete="new-password"')+textarea('reason','Căn cứ đặt lại mật khẩu *','','required maxlength="1000"'),async body=>{await api('/admin/accounts/'+account.id,{method:'PATCH',body:{...body,revision:ctx.db.revision}});await saved('Đã cấp mật khẩu tạm, thu hồi phiên cũ và yêu cầu đổi mật khẩu.');});},
        'delete-account':el=>{const {ctx,account}=current(el);modal('Xóa tài khoản',`<p>Xóa quyền đăng nhập của <strong>${esc(account.code)}</strong>. Hồ sơ sinh viên/nhân sự và kết quả học tập được giữ. Nếu tài khoản có lịch sử xử lý, hệ thống chuyển sang danh sách đã xóa để giữ người thực hiện.</p>`+textarea('reason','Lý do xóa *','','required maxlength="1000"'),async body=>{const result=await api('/admin/accounts/'+account.id,{method:'DELETE',body:{...body,revision:ctx.db.revision}});await saved(result.archived?'Đã xóa khỏi sử dụng, giữ lịch sử và chặn đăng nhập.':'Đã xóa tài khoản; hồ sơ liên kết được giữ và có thể cấp lại tài khoản.');});},
        'restore-account':el=>{const {ctx,account}=current(el);modal('Khôi phục tài khoản','<p>Tài khoản khôi phục ở trạng thái khóa. Kiểm tra thông tin và đặt lại mật khẩu nếu cần trước khi mở khóa.</p>'+textarea('reason','Lý do khôi phục *','','required maxlength="1000"'),async body=>{await api('/admin/accounts/'+account.id+'/restore',{method:'POST',body:{...body,revision:ctx.db.revision}});await saved('Đã khôi phục về trạng thái khóa. Kiểm tra trước khi mở khóa.');});}
    };
}
