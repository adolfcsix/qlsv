import { cohorts } from './cohorts.js';
import { faculties } from './faculties.js';
import { majors } from './majors.js';
import { programs } from './programs.js';
import { student_groups } from './student-groups.js';
const screens = { cohorts: cohorts, departments: faculties, majors: majors, programs: programs, groups: student_groups };
export function organization(ctx) { const tab = ctx.parts[2] in screens ? ctx.parts[2] : 'groups'; return screens[tab](ctx); }
