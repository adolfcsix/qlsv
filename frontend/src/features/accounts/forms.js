import { api, isOnline, signOut } from '../../services/repository.js';
import { go } from '../../app/router.js';
import { accountRoleLabels, availableAccountProfiles, accountProfiles, profileKind } from './profile-options.js';
import { esc, field, select, textarea, modal, info, person, btn, toast } from '../../components/ui.js';
import { details } from '../../pages/_shared.js';
export function createFormHandlers(runtime) {
    const {context,saved}=runtime;
    async function accountForm(profileKey='',accountId=null) {
        const ctx=context();
        if(ctx.user.role!=='sysadmin')throw new Error('Chỉ quản trị quản lý tài khoản.');
        if(!isOnline())throw new Error('Chạy bản full-stack để tạo hoặc sửa tài khoản.');
        const old=accountId?ctx.db.accounts.find(a=>a.id===accountId):null;
        if(accountId&&!old)throw new Error('Không tìm thấy tài khoản.');
        if(old?.archived)throw new Error('Khôi phục tài khoản đã xóa trước khi sửa.');
        const hint=profileKey.split(':'),initialRole=old?.role||(['student','lecturer','academic','sysadmin'].includes(hint[0])?hint[0]:'student');
        modal(old?'Sửa tài khoản & phân vai trò':'Tạo / cấp tài khoản',`<div class="form-grid">`+
            field('username','Tên đăng nhập *',old?.code||'','text','required pattern="[A-Za-z0-9_.-]{3,100}" maxlength="100" autocomplete="off"')+
            field('email','Email đăng nhập *',old?.email||'','email','required maxlength="255" autocomplete="off"')+
            select('role','Vai trò *',Object.entries(accountRoleLabels),initialRole,'required'+(old?.id===ctx.user.id?' disabled':''))+
            select('status','Trạng thái',[['active','Đang hoạt động'],['locked','Đã khóa']],old?.status||'active',old?.id===ctx.user.id?'disabled':'')+
            `<section class="full account-profile-panel"><div data-account-profile-fields></div><p class="helper" data-account-profile-note></p></section>`+
            (!old?field('temporaryPassword','Mật khẩu tạm *','','password','required minlength="10" maxlength="128" autocomplete="new-password"'):'')+
            textarea('reason',old?'Lý do cập nhật *':'Căn cứ cấp tài khoản *','','required maxlength="1000"')+
            '</div><p class="helper">Vai trò phải gắn đúng hồ sơ. Khi đổi vai trò, hồ sơ cũ và dữ liệu học vụ được giữ, liên kết đăng nhập chuyển sang hồ sơ mới. Phiên đăng nhập cũ bị thu hồi.</p>',async values=>{
                const dialog=document.querySelector('#modal'),role=values.role || old?.role;
                const body={revision:ctx.db.revision,username:values.username,email:values.email,role,status:values.status || old?.status,reason:values.reason};
                const choice=dialog.querySelector('[name="profileChoice"]').value;
                if(choice==='new')body.newProfile={code:values.profileCode,name:values.profileName,departmentId:values.departmentId,phone:values.profilePhone||''};
                else {if(!choice)throw new Error('Chọn hồ sơ liên kết.');body.profileId=choice;}
                if(!old)body.temporaryPassword=values.temporaryPassword;
                const result=await api('/admin/accounts'+(old?'/'+old.id:''),{method:old?'PATCH':'POST',body});
                if(result.reauthenticate){await signOut();toast('Đã cập nhật tài khoản của bạn. Vui lòng đăng nhập lại.');go('/login');return;}
                await saved(old?'Đã sửa tài khoản và cập nhật quyền truy cập.':'Đã cấp tài khoản. Người dùng phải đổi mật khẩu tạm ở lần đăng nhập đầu.');
            },true);
        const dialog=document.querySelector('#modal'),roleSelect=dialog.querySelector('[name="role"]'),panel=dialog.querySelector('[data-account-profile-fields]'),note=dialog.querySelector('[data-account-profile-note]');
        function renderProfile(keep=false) {
            const role=roleSelect.value,profiles=availableAccountProfiles(ctx.db,role,old?.id||'');
            const selected=keep?(old?.profileId||hint[1]||''):'';
            panel.innerHTML=select('profileChoice','Hồ sơ liên kết *',[['','Chọn hồ sơ đã xác minh'],...profiles.map(p=>[p.id,p.code+' · '+p.name]),...(role!=='student'?[['new','+ Tạo hồ sơ '+accountRoleLabels[role].toLowerCase()+' mới']]:[])],selected,'required')+'<div data-new-profile></div>';
            note.textContent=role==='student'?'Hồ sơ sinh viên do cán bộ đào tạo lập; quản trị cấp tài khoản từ hồ sơ đó.':'Có thể liên kết hồ sơ chưa cấp tài khoản hoặc tạo hồ sơ nhân sự mới ngay tại đây.';
            const choice=panel.querySelector('[name="profileChoice"]'),newPanel=panel.querySelector('[data-new-profile]');
            function change(){newPanel.innerHTML=choice.value==='new'?`<div class="form-grid compact-fields">${field('profileCode','Mã hồ sơ *','','text','required maxlength="30" pattern="[A-Za-z0-9_.-]{2,30}"')}${field('profileName','Họ và tên *',old?.name||'','text','required maxlength="200"')}${select('departmentId','Khoa / đơn vị *',ctx.db.departments.map(d=>[d.id,d.code+' · '+d.name]),'','required')}${field('profilePhone','Điện thoại','','tel','maxlength="30"')}</div>`:'';}
            choice.addEventListener('change',change);change();
        }
        roleSelect.addEventListener('change',()=>renderProfile(false));renderProfile(true);
    }
    function accountDetail(id) {
        const ctx=context();if(ctx.user.role!=='sysadmin')throw new Error('Không đủ quyền.');
        const a=ctx.db.accounts.find(a=>a.id===id);if(!a)throw new Error('Không tìm thấy tài khoản.');
        const profile=accountProfiles(ctx.db).find(p=>p.kind===profileKind(a.role)&&p.id===a.profileId);
        info('Chi tiết tài khoản',person(a)+details([['Tên đăng nhập',a.code],['Email',a.email],['Vai trò',accountRoleLabels[a.role]],['Hồ sơ',profile?profile.code+' · '+profile.name:'Chưa liên kết'],['Trạng thái',a.archived?'Đã xóa khỏi sử dụng':a.status==='active'?'Đang hoạt động':'Đã khóa'],['Mật khẩu',a.mustChange?'Phải đổi mật khẩu tạm':'Không hiển thị'],...(a.archived?[['Ngày xóa',a.archivedAt],['Lý do',a.archiveReason]]:[])])+`<div class="dialog-actions">${a.archived?btn('Khôi phục','restore-account','','data-id="'+id+'"'):btn('Sửa / phân vai trò','edit-account','primary','data-id="'+id+'"')+(a.id!==ctx.user.id?btn(a.status==='active'?'Khóa':'Mở khóa','lock-account','','data-id="'+id+'"')+btn('Đặt lại mật khẩu','reset-password','','data-id="'+id+'"')+btn('Xóa tài khoản','delete-account','danger-btn','data-id="'+id+'"'):'')}</div>`);
    }
    return {accountForm,accountDetail};
}
