import { statuses } from '../demo/data.js';
import { esc } from './format.js';
export const badge = (s, label) => `<span class="badge ${['active', 'studying', 'published', 'approved', 'passed', 'completed'].includes(s) ? 'good' : ['locked', 'suspended', 'rejected', 'failed', 'cancelled'].includes(s) ? 'danger' : ['draft', 'submitted', 'needs_info', 'on_leave'].includes(s) ? 'warm' : 'neutral'}"><i></i>${esc(label || statuses[s] || s)}</span>`;
