import { sysadminDashboard } from './sysadmin-dashboard.js';
import { academicDashboard } from './academic-dashboard.js';
import { lecturerDashboard } from './lecturer-dashboard.js';
import { studentDashboard } from './student-dashboard.js';
const screens = { sysadmin: sysadminDashboard, academic: academicDashboard, lecturer: lecturerDashboard, student: studentDashboard };
export function dashboard(ctx) { return (screens[ctx.user.role] || academicDashboard)(ctx); }
