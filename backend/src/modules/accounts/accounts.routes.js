import { admin } from '../operations/change-utils.js';
import { accountRevision, writeAccountWithin, deleteAccountWithin, restoreAccountWithin } from './accounts.service.js';
export async function handleAccountsRoutes(ctx) {
    const root=ctx.route==='/api/v1/admin/accounts',match=/^\/api\/v1\/admin\/accounts\/(\d+)(\/restore)?$/.exec(ctx.route);
    if(!root&&!match)return false;
    if(!(root&&ctx.method==='POST'||match&&!match[2]&&['PATCH','DELETE'].includes(ctx.method)||match?.[2]&&ctx.method==='POST'))return false;
    admin(ctx.user);const body=await ctx.body();
    const result=await ctx.db.tx(async()=>{
        await accountRevision(ctx.db,body);
        const result=root?await writeAccountWithin(ctx.db,ctx.user,null,body):match[2]?await restoreAccountWithin(ctx.db,ctx.user,match[1],body):ctx.method==='DELETE'?await deleteAccountWithin(ctx.db,ctx.user,match[1],body):await writeAccountWithin(ctx.db,ctx.user,match[1],body);
        await ctx.db.run('UPDATE app_lock SET revision=revision+1 WHERE lock_id=1');return result;
    });
    ctx.json(root?201:200,{data:result});return true;
}
