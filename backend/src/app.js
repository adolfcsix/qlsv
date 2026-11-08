import { handleAdminWorkspace } from './modules/admin/admin.routes.js';
import { handleAccountsRoutes } from './modules/accounts/accounts.routes.js';
import { handleScheduling } from './modules/scheduling/scheduling.routes.js';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './config/database.js';
import { seedDemo } from '../database/seeds/demo.seed.js';
import { AppError, ensure } from './core/errors.js';
import { readJson } from './core/request.js';
import { sendJson } from './core/response.js';
import { dispatchRoutes } from './core/router.js';
import { requireSession } from './middlewares/authenticate.js';
import { checkWriteRequest } from './middlewares/csrf.js';
import { createRateLimiter } from './middlewares/rate-limit.js';
import { handleLogin, handleAuth } from './modules/auth/auth.routes.js';
import { handleReports } from './modules/reports/reports.routes.js';
import { handleChanges } from './modules/operations/changes.routes.js';
import { handleEnrollments } from './modules/enrollments/enrollments.routes.js';
import { handleAssessment } from './modules/assessment/assessment.routes.js';
import { handleExams } from './modules/exams/exams.routes.js';
import { handleStudents } from './modules/students/students.routes.js';
import { handleOrganization } from './modules/organization/organization.routes.js';
import { handleAi } from './modules/ai/ai.routes.js';
import { handleLookups } from './modules/lookups/lookups.routes.js';
import { handleCourseSections } from './modules/teaching/course-sections.routes.js';
import { handleTimetable } from './modules/timetable/timetable.routes.js';
import { handleAffairs } from './modules/student-affairs/affairs.routes.js';
import { handleCurriculum } from './modules/curriculum/curriculum.routes.js';
const WEB_ROOT = path.resolve(fileURLToPath(new URL('../../frontend', import.meta.url)));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ttf': 'font/ttf' };
const handlers = [handleAuth, handleAdminWorkspace, handleAccountsRoutes, handleScheduling, handleReports, handleChanges, handleEnrollments,
    handleAssessment, handleExams, handleOrganization, handleLookups, handleCourseSections, handleTimetable, handleStudents, handleAi, handleAffairs, handleCurriculum];
async function serveStatic(req, res, route, method) {
    ensure(['GET', 'HEAD'].includes(method), 'Phương thức không được hỗ trợ.', 405);
    let file;
    try {
        // Only this public shared module is exposed; backend/config files stay private.
        if (route === '/shared/lookup-intents.js') {
            const contents = await readFile(new URL('../../shared/lookup-intents.js', import.meta.url));
            res.writeHead(200, { 'Content-Type': mime['.js'], 'Cache-Control': 'no-cache' });
            res.end(method === 'HEAD' ? undefined : contents);
            return;
        }
        file = path.resolve(WEB_ROOT, '.' + decodeURIComponent(route));
    }
    catch {
        throw new AppError(400, 'INVALID_PATH', 'Đường dẫn không hợp lệ.');
    }
    ensure(file === WEB_ROOT || file.startsWith(WEB_ROOT + path.sep), 'Không có quyền truy cập.', 403);
    try {
        if ((await stat(file)).isDirectory())
            file = path.join(file, 'index.html');
    }
    catch {
        throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy trang.');
    }
    ensure(Object.hasOwn(mime, path.extname(file)), 'Không có quyền đọc tài nguyên này.', 403);
    const contents = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)],
        'Cache-Control': path.extname(file) === '.ttf' ? 'public, max-age=604800' : 'no-cache' });
    res.end(method === 'HEAD' ? undefined : contents);
}
export async function createApp(options = {}) {
    const db = options.db || await openDatabase();
    await db.initialize();
    if (options.seed || process.env.SEED_DEMO === '1')
        await seedDemo(db);
    const limit = createRateLimiter();
    const server = http.createServer(async (req, res) => {
        const requestId = randomUUID();
        res.setHeader('X-Request-Id', requestId);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
        try {
            const url = new URL(req.url, 'http://localhost');
            const route = url.pathname, method = req.method;
            const ctx = { db, req, res, url, route, method, limit, body: () => readJson(req), json: (status, data) => sendJson(res, status, data) };
            if (route === '/api/v1/health' && method === 'GET') {
                ctx.json(200, { data: { status: 'ok', driver: db.driver,
                        mode: process.env.SEED_DEMO === '1' || options.seed ? 'demo' : 'configured',
                        ai: process.env.AI_API_KEY ? 'ai_tools' : process.env.AI_REQUIRE_LIVE === '1' ? 'ai_missing' : 'local_lookup' } });
                return;
            }
            if (route.startsWith('/api/')) {
                limit(req.socket.remoteAddress + ':api', 300);
                checkWriteRequest(req, method, null); // origin validation for login, too
                if (await handleLogin(ctx))
                    return;
                ctx.user = await requireSession(db, req);
                checkWriteRequest(req, method, ctx.user); // CSRF for authenticated mutations
                if (await handleAuth(ctx))
                    return;
                if (ctx.user.mustChange)
                    ensure(route === '/api/v1/state', 'Cần đổi mật khẩu trước khi tiếp tục.', 403, 'PASSWORD_CHANGE_REQUIRED');
                if (await dispatchRoutes(ctx, handlers.slice(1)))
                    return;
                throw new AppError(404, 'NOT_FOUND', 'API không tồn tại.');
            }
            await serveStatic(req, res, route, method);
        }
        catch (err) {
            const constraint = /constraint|duplicate|foreign key/i.test(err.message || '');
            const status = err.status || (constraint ? 409 : 500);
            const code = err instanceof AppError ? err.code : constraint ? 'DATA_CONFLICT' : 'INTERNAL_ERROR';
            if (status === 500)
                console.error('[API]', requestId, err.message);
            if (!res.headersSent)
                sendJson(res, status, { error: { code,
                        message: err instanceof AppError ? err.message : constraint ?
                            'Dữ liệu trùng hoặc đang có quan hệ. Không thể lưu thao tác.' :
                            'Không thể xử lý yêu cầu. Vui lòng thử lại.', requestId } });
            else
                res.end();
        }
    });
    server.requestTimeout = 30000;
    server.headersTimeout = 15000;
    return { server, db };
}
