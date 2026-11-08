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

    return `<article class="chat-message assistant-message">
        <span class="chat-avatar">${brandMark()}</span>
        <div class="chat-answer">
            <span class="chat-speaker">Lac Hong · ${result.replyMode === 'llm' ? 'AI diễn giải' : 'Tra cứu dữ liệu'}</span>
            <p class="chat-reply">${esc(result.reply || result.message)}</p>
            ${result.notice ? `<p class="chat-notice">${esc(result.notice)}</p>` : ''}
            ${dataset}
            ${references}
            ${evidence}
        </div>
    </article>`;
}
