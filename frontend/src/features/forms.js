import { createFormHandlers as orgForms } from './organization/forms.js';
import { createFormHandlers as studentForms } from './students/forms.js';
import { createFormHandlers as requestsForms } from './requests/dialogs.js';
import { createFormHandlers as accountsForms } from './accounts/forms.js';
import { createFormHandlers as assessmentForms } from './assessment/drafts.js';
export function createForms(runtime) {
    return { ...orgForms(runtime), ...studentForms(runtime), ...requestsForms(runtime), ...accountsForms(runtime), ...assessmentForms(runtime) };
}
