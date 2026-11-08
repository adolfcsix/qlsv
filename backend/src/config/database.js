import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';
export async function openDatabase(config = {}) {
    const driver = config.driver || process.env.DB_DRIVER || 'sqlite';
    const context = new AsyncLocalStorage();
    let native, pool;
    if (driver === 'mysql') {
        const { createPool } = await import('mysql2/promise');
        pool = createPool({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'qlsv', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'qlsv', connectionLimit: 8, dateStrings: true, decimalNumbers: true, charset: 'utf8mb4', multipleStatements: false });
    }
    else if (driver === 'sqlite') {
        const { DatabaseSync } = await import('node:sqlite');
        const file = config.file || process.env.SQLITE_PATH || resolve('backend/data/qlsv.db');
        if (file !== ':memory:')
            await mkdir(dirname(file), { recursive: true });
        native = new DatabaseSync(file);
        native.function('QLSV_NORMALIZE', { deterministic: true }, s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('đ', 'd').replaceAll('Đ', 'D').toLowerCase());
        native.function('CHAR_LENGTH', { deterministic: true }, s => s === null ? null : [...String(s)].length);
        native.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
        if (file !== ':memory:')
            native.exec('PRAGMA journal_mode=WAL;');
    }
    else
        throw new Error('DB_DRIVER phải là mysql hoặc sqlite.');
    const db = { driver,
        async all(sql, params = []) { if (native)
            return native.prepare(sql).all(...params); const [rows] = await (context.getStore() || pool).execute(sql, params); return rows; },
        async get(sql, params = []) { return (await this.all(sql, params))[0]; },
        async run(sql, params = []) { if (native) {
            const r = native.prepare(sql).run(...params);
            return { insertId: Number(r.lastInsertRowid), changes: Number(r.changes) };
        } const [r] = await (context.getStore() || pool).execute(sql, params); return { insertId: r.insertId, changes: r.affectedRows }; },
        async insert(table, values) { const keys = Object.keys(values); const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`; return (await this.run(sql, Object.values(values).map(x => x === undefined ? null : x))).insertId; },
        async update(table, pk, id, values) { const keys = Object.keys(values); if (!keys.length)
            return; return this.run(`UPDATE ${table} SET ${keys.map(k => k + '=?').join(',')} WHERE ${pk}=?`, [...Object.values(values).map(x => x === undefined ? null : x), id]); },
        async close() { if (native)
            native.close(); if (pool)
            await pool.end(); },
        async initialize() {
            if (native) {
                const schema = await readFile(new URL('../../database/qlsv-sqlite.sql', import.meta.url), 'utf8');
                native.exec(schema);
                // V03 used MySQL BIGINT AUTO_INCREMENT syntax for this one SQLite table.
                // SQLite accepted it as a type name, leaving every generated audit_id NULL.
                const auditColumn = native.prepare('PRAGMA table_info(audit_logs)').all().find(c => c.name === 'audit_id');
                if (auditColumn?.type !== 'INTEGER') {
                    const statement = schema.match(/CREATE TABLE IF NOT EXISTS audit_logs \([\s\S]*?\);/)[0];
                    const columns = native.prepare('PRAGMA table_info(audit_logs)').all().map(c => c.name);
                    native.exec('BEGIN IMMEDIATE');
                    try {
                        native.exec('ALTER TABLE audit_logs RENAME TO audit_logs_v03_legacy');
                        native.exec(statement);
                        native.exec(`INSERT INTO audit_logs (${columns.join(',')}) SELECT ${columns.map(c => c === 'audit_id' ? 'rowid' : c).join(',')} FROM audit_logs_v03_legacy ORDER BY rowid`);
                        native.exec('DROP TABLE audit_logs_v03_legacy');
                        native.exec('COMMIT');
                    }
                    catch (e) {
                        native.exec('ROLLBACK');
                        throw e;
                    }
                }
            }
            else {
                const exists = await this.get("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='users'");
                if (!exists.n) {
                    const src = (await readFile(new URL('../../database/qlsv-original.sql', import.meta.url), 'utf8')).replace(/--[^\n]*/g, '');
                    for (const statement of src.split(';').map(s => s.trim()).filter(Boolean)) {
                        if (/^(CREATE TABLE)/i.test(statement))
                            await (context.getStore() || pool).query(statement);
                    }
                }
            }
            let extension = await readFile(new URL('../../database/extensions.sql', import.meta.url), 'utf8');
            if (driver === 'mysql')
                extension = extension.replaceAll('INTEGER PRIMARY KEY AUTOINCREMENT', 'INT AUTO_INCREMENT PRIMARY KEY').replaceAll('INTEGER', 'INT');
            for (const statement of extension.split(';').map(s => s.trim()).filter(Boolean)) {
                if (native)
                    native.exec(statement);
                else
                    await pool.query(statement);
            }
            let periodMigration = await readFile(new URL('../../database/migrations/v06-20-session-periods.sql', import.meta.url), 'utf8');
            if(driver==='mysql')periodMigration=periodMigration.replaceAll('INTEGER','INT');
            for(const statement of periodMigration.split(';').map(s=>s.trim()).filter(Boolean)){if(native)native.exec(statement);else await pool.query(statement);}
            // Versioned extension: idempotent migration, executed for both database drivers.
            // Tables live outside the 36-table academic reference schema.
            let academicMigration = await readFile(new URL('../../database/migrations/v06-11-academic-decisions.sql', import.meta.url), 'utf8');
            academicMigration = academicMigration.replace(/--[^\n]*/g, '');
            if (driver === 'mysql')
                academicMigration = academicMigration.replaceAll('INTEGER PRIMARY KEY AUTOINCREMENT', 'INT AUTO_INCREMENT PRIMARY KEY');
            for (const statement of academicMigration.split(';').map(part => part.trim()).filter(Boolean)) {
                if (native) native.exec(statement);
                else await pool.query(statement);
            }
            let staffMigration = await readFile(new URL('../../database/migrations/v06-14-staff-workspace.sql', import.meta.url), 'utf8');
            if (driver === 'mysql') staffMigration = staffMigration
                .replaceAll('INTEGER PRIMARY KEY AUTOINCREMENT', 'INT AUTO_INCREMENT PRIMARY KEY')
                .replaceAll('INTEGER', 'INT')
                .replace(/CREATE INDEX IF NOT EXISTS[^;]+;/g, '');
            for (const statement of staffMigration.split(';').map(s => s.trim()).filter(Boolean)) {
                if (native) native.exec(statement);
                else await pool.query(statement);
            }
            let accountMigration = await readFile(new URL('../../database/migrations/v06-15-accounts.sql', import.meta.url), 'utf8');
            if (driver === 'mysql') accountMigration = accountMigration.replaceAll('INTEGER', 'INT');
            for (const statement of accountMigration.split(';').map(s=>s.trim()).filter(Boolean)) {
                if (native) native.exec(statement); else await pool.query(statement);
            }
            let adminMigration = await readFile(new URL('../../database/migrations/v06-16-admin-workspace.sql', import.meta.url), 'utf8');
            if (driver === 'mysql') adminMigration = adminMigration.replaceAll('INTEGER', 'INT');
            for (const statement of adminMigration.split(';').map(s=>s.trim()).filter(Boolean)) {
                if (native) native.exec(statement); else await pool.query(statement);
            }
            const usedRooms = await this.all('SELECT room_id FROM class_schedules UNION SELECT room_id FROM exam_sessions');
            for (const room of usedRooms) if (!await this.get('SELECT room_id FROM room_usage_history WHERE room_id=?',[room.room_id]))
                await this.insert('room_usage_history',{room_id:room.room_id});
            for (const name of ['ADMIN', 'ACADEMIC_STAFF', 'LECTURER', 'STUDENT'])
                if (!await this.get('SELECT role_id FROM roles WHERE name=?', [name]))
                    await this.insert('roles', { name });
            if (!await this.get('SELECT lock_id FROM app_lock WHERE lock_id=1'))
                await this.insert('app_lock', { lock_id: 1, revision: 0 });
        }
    };
    let tail = Promise.resolve();
    db.tx = fn => { const work = tail.then(async () => { if (native) {
        native.exec('BEGIN IMMEDIATE');
        try {
            const value = await fn();
            native.exec('COMMIT');
            return value;
        }
        catch (e) {
            native.exec('ROLLBACK');
            throw e;
        }
    } const conn = await pool.getConnection(); try {
        return await context.run(conn, async () => { await conn.beginTransaction(); try {
            await conn.execute('SELECT revision FROM app_lock WHERE lock_id=1 FOR UPDATE');
            const value = await fn();
            await conn.commit();
            return value;
        }
        catch (e) {
            await conn.rollback();
            throw e;
        } });
    }
    finally {
        conn.release();
    } }); tail = work.catch(() => { }); return work; };
    return db;
}
