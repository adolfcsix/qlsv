import { createActions as adminPersonnelActions } from '../admin/personnel-actions.js';
import { createActions as adminCalendarActions } from '../admin/calendar-actions.js';
import { createActions as adminRoomActions } from '../admin/room-actions.js';
import { createActions as staffSchedulingActions } from '../timetable/staff-actions.js';
import { createActions as commonActions } from './common.js';
import { createActions as organizationActions } from './organization.js';
import { createActions as studentsActions } from './students.js';
import { createActions as accountsActions } from './accounts.js';
import { createActions as requestsActions } from './requests.js';
import { createActions as enrollmentActions } from './enrollment.js';
import { createActions as teachingActions } from './teaching.js';
import { createActions as assessmentActions } from './assessment.js';
import { createActions as examsActions } from './exams.js';
import { createActions as financeActions } from './finance.js';
import { createActions as affairsActions } from './student-affairs.js';
import { createActions as curriculumActions } from './curriculum.js';
import { createActions as graduationActions } from './graduation.js';
// Mỗi hành động được khai báo duy nhất tại phân hệ chủ quản.
export function createActions(runtime) {
    const actions = { ...commonActions(runtime),
        ...organizationActions(runtime),
        ...studentsActions(runtime),
        ...accountsActions(runtime),
        ...requestsActions(runtime),
        ...enrollmentActions(runtime),
        ...teachingActions(runtime),
        ...assessmentActions(runtime),
        ...examsActions(runtime),
        ...financeActions(runtime),
        ...affairsActions(runtime),
        ...curriculumActions(runtime),
        ...graduationActions(runtime), ...staffSchedulingActions(runtime), ...adminPersonnelActions(runtime), ...adminCalendarActions(runtime), ...adminRoomActions(runtime) };
    actions['portal-day']=el=>{const day=el.dataset.day||'';if(day&&!/^\d{4}-\d{2}-\d{2}$/.test(day))return;runtime.state.filters.portalDay=day;runtime.render();document.querySelector(`[data-action="portal-day"][data-day="${day}"]`)?.focus();};
    actions['admin-overview-list']=el=>{runtime.state.filters.overviewKind=el.dataset.list;runtime.state.filters.overviewIssue=el.dataset.issue||'';runtime.state.filters.page=1;delete runtime.state.filters.search;runtime.render();};
    actions['admin-overview-department']=el=>{runtime.state.filters.overviewDepartment=el.dataset.id;runtime.state.filters.overviewKind='students';delete runtime.state.filters.overviewIssue;delete runtime.state.filters.overviewMajor;delete runtime.state.filters.overviewGroup;delete runtime.state.filters.search;runtime.state.filters.page=1;runtime.render();};
    return actions;
}
