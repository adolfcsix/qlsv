import { esc } from '../../components/format.js';
export const activities={lecture:'Lý thuyết',practice:'Thực hành',seminar:'Thảo luận',online:'Trực tuyến',other:'Buổi học khác'};
export function durationMinutes(s){const parse=t=>/^\d{2}:\d{2}/.test(t||'')?Number(t.slice(0,2))*60+Number(t.slice(3,5)):NaN;const n=parse(s.end)-parse(s.start);return Number.isFinite(n)&&n>0?n:null;}
export function periodLabel(s){if(s.type==='exam')return 'Lịch thi';const p=s.periods;if(!p)return 'Chưa khai báo số tiết';return (p.first?`Tiết ${p.first}–${p.first+p.count-1} · `:'')+p.count+' tiết';}
export function durationLabel(s){const n=durationMinutes(s);if(!s.periods||s.type==='exam')return n===null?'Chưa có thời lượng':n+' phút';return `${s.periods.minutes} phút/tiết · ${s.periods.breakMinutes} phút nghỉ · ${n} phút/buổi`;}
export function teacherLabel(s){if(s.type==='exam')return 'Giảng viên/coi thi: chưa có dữ liệu phân công';const names=s.teachers||s.teacherNames||[];return names.length?names.join(', '):'Chưa phân công giảng viên';}
export function sessionFacts(s){return `<span class="session-periods">${esc(periodLabel(s))}</span><small>${esc(durationLabel(s))}</small>${s.periods?`<small>${esc(activities[s.periods.activity]||'Buổi học')}</small>`:''}`;}
