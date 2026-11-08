export const accountRoleLabels={student:'Sinh viên',lecturer:'Giảng viên',academic:'Cán bộ đào tạo',sysadmin:'Quản trị'};
export const profileKind=role=>['academic','sysadmin'].includes(role)?'staff':role;
export function accountProfiles(db) {
    if(Array.isArray(db.accountProfiles))return db.accountProfiles;
    return [...(db.students||[]).map(p=>({...p,kind:'student'})),...(db.lecturers||[]).map(p=>({...p,kind:'lecturer'}))].map(p=>({...p,userId:db.accounts.find(a=>profileKind(a.role)===p.kind&&a.profileId===p.id)?.id||''}));
}
export function availableAccountProfiles(db,role,accountId='') {
    return accountProfiles(db).filter(p=>p.kind===profileKind(role)&&(!p.userId||p.userId===accountId));
}
