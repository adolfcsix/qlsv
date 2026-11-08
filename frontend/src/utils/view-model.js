// Pure view models shared by pages, exports and tests.
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim();
export const matches = (value, query) => normalize(value).includes(normalize(query));
export function filteredStudents(ctx) {
    const { db, user, filters = {} } = ctx;
    return db.students.filter(s => {
        const g = db.groups.find(g => g.id === s.groupId), p = db.programs.find(p => p.id === g?.programId);
        return (user.role !== 'lecturer' || g?.advisor === user.profileId) && matches(`${s.code} ${s.name}`, filters.search) && (!filters.cohort || p?.cohortId === filters.cohort) && (!filters.major || p?.majorId === filters.major) && (!filters.department || db.majors.some(m => m.id === p?.majorId && m.departmentId === filters.department)) && (!filters.program || g?.programId === filters.program) && (!filters.group || s.groupId === filters.group) && (!filters.status || s.status === filters.status);
    });
}
export function pageSlice(rows, filters = {}, size = 8) {
    const pages = Math.max(1, Math.ceil(rows.length / size)), page = Math.max(1, Math.min(pages, Number(filters.page) || 1));
    return { rows: rows.slice((page - 1) * size, page * size), page, pages, total: rows.length, from: rows.length ? (page - 1) * size + 1 : 0, to: Math.min(page * size, rows.length) };
}
export function gradeMeta(db, classId) {
    return db.assessmentMeta?.[classId] || [{ key: 'process', name: 'Quá trình', weight: 20, max: 10 }, { key: 'midterm', name: 'Giữa kỳ', weight: 30, max: 10 }, { key: 'final', name: 'Cuối kỳ', weight: 50, max: 10 }];
}
export function gradeTotal(row, meta) {
    if (Math.abs(meta.reduce((s, a) => s + a.weight, 0) - 100) > .001 || meta.some(a => row[a.key] === null || row[a.key] === undefined || !Number.isFinite(Number(row[a.key]))))
        return null;
    return meta.reduce((s, a) => s + Number(row[a.key]) / a.max * 10 * a.weight / 100, 0);
}
export function termInfo(db) { return db.term || { name: 'HK I', year: '2026–2027', start: '2026-09-01', end: '2027-01-31', registrationStart: null, registrationEnd: null }; }
export function scheduleEvents(db, classes, start, end) {
    const ids = new Set(classes.map(c => c.id));
    const definitions = db.schedules || classes.map(c => ({ classId: c.id, day: c.day, start: c.start, end: c.end, room: c.room, from: '1900-01-01', to: '2100-12-31' }));
    const dates = [];
    const day = new Date(start + 'T00:00:00Z');
    while (day.toISOString().slice(0, 10) <= end) {
        dates.push(day.toISOString().slice(0, 10));
        day.setUTCDate(day.getUTCDate() + 1);
    }
    const rows = [];
    for (const date of dates) {
        const weekday = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7 + 1;
        for (const s of definitions)
            if (ids.has(s.classId) && s.day === weekday && (!s.from || date >= s.from) && (!s.to || date <= s.to))
                rows.push({ ...s, date, type: 'study' });
    }
    for (const e of db.exams)
        if (ids.has(e.classId) && ['published', 'completed'].includes(e.status) && e.date >= start && e.date <= end)
            rows.push({ ...e, type: 'exam' });
    return rows.sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`));
}
export function weekRange(offset = 0, now = new Date()) {
    const vn = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const day = (vn.getDay() + 6) % 7;
    vn.setDate(vn.getDate() - day + offset * 7);
    const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(vn); d.setDate(d.getDate() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    return { start: dates[0], end: dates[6], dates };
}
export function filteredGrades(ctx, classId) { return ctx.db.grades.filter(g => { const s = ctx.db.students.find(s => s.id === g.studentId); return g.classId === classId && matches(`${s?.name} ${s?.code}`, ctx.filters.search) && (!ctx.filters.status || (ctx.filters.status === 'published' ? g.published : !g.published)); }); }
