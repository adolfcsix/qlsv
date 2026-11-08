import { ensure } from '../../core/errors.js';
import { writeAccountWithin, deleteAccountWithin } from './accounts.service.js';
// Reuse the same domain writer: the old endpoint cannot bypass account/last-admin guards.
export async function handleAccounts({db,user,body,a,b,n}) {
    if(!a){ensure(b&&n,'Thiếu tài khoản cần xóa.');await deleteAccountWithin(db,user,n,body);return true;}
    await writeAccountWithin(db,user,b?n:null,{...a,username:a.code,temporaryPassword:body.temporaryPassword,reason:body.reason});
    return true;
}
