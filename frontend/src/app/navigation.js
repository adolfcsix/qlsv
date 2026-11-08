export const navigation = {
    sysadmin: [['dashboard', 'Tổng quan', 'grid'], ['accounts', 'Tài khoản', 'users'], ['personnel', 'Giảng viên & cán bộ', 'users'], ['calendar', 'Năm học & học kỳ', 'calendar'], ['rooms', 'Phòng học & phòng thi', 'layers'], ['audit', 'Nhật ký', 'clock']],
    academic: [['dashboard', 'Tổng quan', 'grid'], ['organization', 'Khóa · Khoa · Ngành · Lớp', 'layers'], ['students', 'Sinh viên', 'users'], ['curriculum', 'Chương trình học', 'layers'], ['courses', 'Lớp học phần', 'book'], ['schedule', 'Xếp lịch & duyệt đăng ký', 'calendar'], ['grades', 'Sổ điểm', 'chart'], ['semester', 'Tổng kết & cảnh báo', 'chart'], ['graduation', 'Công nhận & xét tốt nghiệp', 'cap'], ['requests', 'Yêu cầu học vụ', 'file'], ['exams', 'Kỳ thi', 'cap'], ['fees', 'Học phí & công nợ', 'wallet'], ['reports', 'Báo cáo', 'chart']],
    lecturer: [['dashboard', 'Tổng quan', 'grid'], ['courses', 'Lớp giảng dạy', 'book'], ['grades', 'Sổ điểm', 'chart'], ['schedule', 'Lịch giảng dạy', 'calendar'], ['advisor', 'Lớp cố vấn', 'users'], ['exams', 'Kỳ thi', 'cap']],
    student: [['dashboard', 'Tổng quan', 'grid'], ['plan', 'Chương trình học', 'layers'], ['registration', 'Đăng ký học phần', 'book'], ['schedule', 'Thời khóa biểu', 'calendar'], ['results', 'Kết quả học tập', 'chart'], ['requests', 'Yêu cầu học vụ', 'file'], ['exams', 'Kỳ thi', 'cap'], ['fees', 'Học phí & công nợ', 'wallet']]
};
export const personalRoute = u => u.role === 'student' ? `/student/profile/${u.profileId}/personal` : `/${u.role}/account`;
export const securityRoute = u => u.role === 'student' ? `/student/profile/${u.profileId}/account` : `/${u.role}/account/security`;
export const memberTabs = [['personal', 'Thông tin cá nhân'], ['contacts', 'Người liên hệ'], ['account', 'Tài khoản & bảo mật']];
export function canonicalRoute(user, parts) {
    if (parts[1] === 'password')
        return securityRoute(user);
    if (parts[1] === 'create-account')
        return '/sysadmin/accounts/unassigned';
    if (user.role === 'student' && parts[1] === 'account')
        return securityRoute(user);
    if (user.role === 'student' && parts[1] === 'profile') {
        const destinations = { overview: personalRoute(user), attempts: '/student/results', progress: '/student/results', exams: '/student/exams', fees: '/student/fees', requests: '/student/requests', history: '/student/profile/' + user.profileId + '/personal' };
        return destinations[parts[3]] || null;
    }
    return null;
}
