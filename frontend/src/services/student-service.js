import { api, isOnline, read, refresh, transact, audit, uid } from './repository.js';
import { statuses } from '../demo/data.js';

// A single action for an academic status/group decision; backend writes both
// the profile and history in one transaction. Other screens only read the record.
export async function changeStudentStatus(student, { status, groupId }, decision, actor) {
    if (isOnline()) {
        await api('/students/' + encodeURIComponent(student.id), {
            method: 'PATCH', body: {
                revision: read().revision,
                before: student,
                after: { ...student, status, groupId },
                decision
            }
        });
        await refresh();
        return;
    }
    await transact(db => {
        Object.assign(db.students.find(row => row.id === student.id), { status, groupId });
        db.history.unshift({ id: uid('h'), studentId: student.id,
            title: `${statuses[student.status]} → ${statuses[status]}`,
            date: decision.date, decision: decision.decision,
            reason: decision.reason, actor });
        audit(db, actor, 'Biến động học vụ', `${student.code} · ${decision.decision}`);
    });
}
