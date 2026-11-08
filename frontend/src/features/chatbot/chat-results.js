// Kết quả tra cứu của chatbot: dữ liệu, nguồn và liên kết nội bộ an toàn.
import { brandMark } from '../../components/brand.js';
import { statuses } from '../../demo/data.js';
import { isOnline } from '../../services/repository.js';
import { esc, icon, table, link, money } from '../../components/ui.js';

const sourceNames = {
    students: 'Hồ sơ sinh viên',
    student_groups: 'Lớp hành chính',
    curricula: 'Chương trình',
    majors: 'Ngành đào tạo',
    departments: 'Khoa',
    course_results: 'Kết quả công bố',
    enrollments: 'Lần học',
    subjects: 'Học phần',
    semesters: 'Học kỳ',
    charges: 'Khoản thu',
    receipts: 'Phiếu thu'
};

function cellText(row, column) {
    const value = row[column.key];
    if (value === null || value === undefined) return '—';
    if (column.key === 'due') return money(value);
    if (column.key === 'status' || column.key === 'outcome') {
        return statuses[value] || { passed: 'Đã đạt', failed: 'Chưa đạt' }[value] || value;
    }
    if (column.key === 'attempt') {
        return { first: 'Lần đầu', repeat: 'Học lại', improve: 'Cải thiện' }[value] || value;
    }
    return value;
}

export function renderChatResult(result, index, action) {
    const { columns = [], rows = [], links = [], sources = [] } = result;
    // Chỉ cho phép điều hướng đến các màn hình hồ sơ/lớp của hệ thống.
    const safeLinks = links.filter(item =>
        /^\/(academic|student|lecturer)\/(group|profile)\/[a-z0-9-]+(?:\/(overview|personal|fees|progress))?$/i.test(item.href)
    );

    const dataset = columns.length ? `<details class="chat-data">
        <summary>Xem dữ liệu đối chiếu <span>${esc(rows.length)}/${esc(result.total ?? rows.length)}</span></summary>
        ${table(columns.map(column => esc(column.label)),
            rows.map(row => columns.map(column => esc(cellText(row, column)))))}
        ${rows.length ? action('export', 'Xuất bảng CSV', icon('download') + ' Xuất CSV', `data-index="${index}"`) : ''}
    </details>` : '';

    const references = safeLinks.length ? `<div class="chat-links">
        ${safeLinks.slice(0, 4).map(item =>
            link(esc(item.label) + ' ' + icon('arrow'), item.href, 'text-link')).join('')}
    </div>` : '';

    const sourceTime = result.asOf
        ? new Date(result.asOf).toLocaleTimeString('vi-VN', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh'
        }) : 'Chưa rõ thời điểm';
    const evidence = sources.length ? `<details class="chat-evidence">
        <summary>${icon('shield')} ${isOnline() ? 'Nguồn đã kiểm tra' : 'Nguồn mẫu'} · ${esc(sourceTime)}</summary>
        <p>${sources.map(item => esc(sourceNames[item.table] || item.table)).join(' · ')}</p>
    </details>` : '';

    const proposal=result.proposal?`<section class="chat-proposal"><h3>${esc(result.proposal.title)}</h3><dl>${result.proposal.preview.map(p=>`<div><dt>${esc(p.label)}</dt><dd>${esc(p.value)}</dd></div>`).join('')}</dl><p>Hết hạn: ${esc(new Date(result.proposal.expiresAt).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}))}</p>${result.proposal.status==='pending'?`<div class="chat-proposal-actions">${action('confirm-action','Xác nhận tác vụ','Xác nhận',`data-proposal="${esc(result.proposal.id)}" data-index="${index}"`)}${action('cancel-action','Hủy tác vụ','Hủy',`data-proposal="${esc(result.proposal.id)}" data-index="${index}"`)}</div>`:`<strong>${esc(({processing:'Đang xử lý…',confirmed:'Đã thực hiện',cancelled:'Đã hủy',superseded:'Đã được thay thế',expired:'Đã hết hạn'})[result.proposal.status]||'Không còn hiệu lực')}</strong>`}</section>`:'';
    const web=(result.webSources||[]).filter(s=>/^https:\/\//.test(s.url)).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`).join('');
    const searchFramePrefix="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline' https:; img-src https: data:\"><base target=\"_blank\">";
    const searchSuggestions=result.searchSuggestions?`<iframe title="Gợi ý tìm kiếm Google" class="chat-search-suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" srcdoc="${esc(searchFramePrefix+result.searchSuggestions.slice(0,30000))}"></iframe>`:'';
    return `<article class="chat-message assistant-message">
        <span class="chat-avatar">${brandMark()}</span>
        <div class="chat-answer">
            <span class="chat-speaker">Lac Hong · ${result.replyMode === 'action' ? 'Trợ lý thao tác' : result.replyMode === 'general' ? 'Hỏi đáp kiến thức' : result.replyMode === 'llm' ? 'AI diễn giải' : 'Tra cứu dữ liệu'}</span>
            <p class="chat-reply">${esc(result.reply || result.message)}</p>
            ${result.notice ? `<p class="chat-notice">${esc(result.notice)}</p>` : ''}
            ${proposal}${web?`<div class="chat-web-sources">Nguồn web: ${web}</div>`:''}${searchSuggestions}
            ${dataset}
            ${references}
            ${evidence}
        </div>
    </article>`;
}
