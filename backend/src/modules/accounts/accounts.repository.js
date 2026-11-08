export const accountRoles = Object.freeze({
    student: { name:'STUDENT', table:'students', key:'student_id', code:'student_code' },
    lecturer: { name:'LECTURER', table:'lecturers', key:'lecturer_id', code:'lecturer_code' },
    academic: { name:'ACADEMIC_STAFF', table:'staffs', key:'staff_id', code:'staff_code' },
    sysadmin: { name:'ADMIN', table:'staffs', key:'staff_id', code:'staff_code' }
});
export async function unlinkProfiles(db,userId) {
    for(const table of ['students','lecturers','staffs'])await db.run(`UPDATE ${table} SET user_id=NULL WHERE user_id=?`,[userId]);
}
// Schema metadata supplies identifiers, never user input. Future user references are protected too.
export async function accountHasHistory(db,userId) {
    let references=[];
    if(db.driver==='sqlite') {
        const tables=await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        for(const {name} of tables) {
            if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))continue;
            const keys=await db.all(`PRAGMA foreign_key_list(\`${name}\`)`);
            references.push(...keys.filter(k=>k.table==='users'&&k.to==='user_id').map(k=>({table:name,column:k.from})));
        }
    } else references=(await db.all(`SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName
        FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE()
        AND REFERENCED_TABLE_NAME='users' AND REFERENCED_COLUMN_NAME='user_id'`)).map(r=>({table:r.tableName,column:r.columnName}));
    const disposable=new Set(['students.user_id','lecturers.user_id','staffs.user_id','sessions.user_id','user_security.user_id','account_archives.user_id']);
    for(const {table,column} of references) {
        if(disposable.has(table+'.'+column)||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column))continue;
        if(await db.get(`SELECT 1 AS present FROM \`${table}\` WHERE \`${column}\`=? LIMIT 1`,[userId]))return true;
    }
    return false;
}
