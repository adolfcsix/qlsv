# Lac Hong University V06.20 — Thời khóa biểu chi tiết

Ngày 08/11/2026. Bổ sung thông tin từng buổi, giữ nghiệp vụ V06.19 và bộ SQL tham chiếu 36 bảng.

## Cách dùng cho cán bộ

Vào Xếp lịch & duyệt đăng ký, chọn lớp học phần, Thêm buổi học hoặc Sửa buổi. Ngoài thứ, giờ, phòng, khoảng ngày và giáo viên, khai báo:

- Số tiết của buổi; tiết bắt đầu nếu sử dụng đánh số tiết.
- Phút mỗi tiết và tổng phút nghỉ trong buổi.
- Loại buổi: lý thuyết, thực hành, thảo luận, trực tuyến hoặc khác.
- Một/nhiều giảng viên cho đúng buổi; bỏ chọn để gỡ phân công.

Ví dụ 07:30–10:00 là 150 phút: có thể khai báo 3 tiết × 45 phút + 15 phút nghỉ. Khi đánh tiết bắt đầu 1, lịch hiển thị Tiết 1–3 · 3 tiết. Đây là cấu hình minh họa của dự án, không phải khung tiết mặc định của mọi trường. Thời điểm từng lần nghỉ trong buổi chưa được chia nhỏ; hệ thống lưu tổng thời gian nghỉ.

Biểu mẫu báo tổng phút khai báo và số phút theo giờ. Máy chủ yêu cầu hai số khớp, đồng thời kiểm tra dữ liệu nguyên, giới hạn tiết, khoảng ngày, sức chứa, phòng/giảng viên/sinh viên trùng lịch như trước. Không lấy số tín chỉ chia thành tiết. Đổi giờ mà giữ cấu hình tiết không còn khớp bị từ chối. Lỗi được hoàn tác toàn bộ, không ghi dở.

Buổi cũ chưa xác nhận tiết có thể giữ 0 trong biểu mẫu sửa để hiển thị Chưa khai báo số tiết. Khi xác nhận, nhập số tiết thật. Không tự gán tiết vào dữ liệu cũ. Buổi mới trên giao diện yêu cầu ít nhất một tiết; API cũ tiếp tục tương thích, lịch không khai báo vẫn hiển thị đúng giờ và thời lượng.

## Sinh viên và giảng viên

Thời khóa biểu có lịch tuần và danh sách chi tiết. Mỗi buổi hiển thị môn/mã lớp, khoảng tiết và số tiết, giờ bắt đầu–kết thúc, phút/tiết, tổng nghỉ, loại buổi, phòng, giảng viên và hiệu lực theo ngày. Giữ nhãn học ghép/khác lớp. Có lọc theo lớp, tuần trước/sau/hiện tại và tổng số buổi/tiết đã khai báo trong phạm vi đang xem.

Điện thoại dùng thẻ buổi học trong chế độ danh sách để đọc đủ giáo viên, phòng và tiết. Lịch tuần vẫn cho cuộn ngang bảy ngày. Trang tổng quan và thông tin buổi ở danh sách đăng ký cũng nhận dữ liệu tiết.

Giảng viên theo phân công từng buổi, không luôn lấy giảng viên mặc định của lớp. Buổi bỏ phân công hiển thị Chưa phân công giảng viên. Lịch thi chỉ ghi thời lượng thi và nêu chưa có dữ liệu phân công coi thi; không gán giảng viên môn thành người coi thi. Không bổ sung nghiệp vụ phân công coi thi trong bản này.

## Tham khảo chính thức

- HUST: https://qldt.hust.edu.vn/students/learn/timetable — giao diện công khai phân biệt lịch và chi tiết học phần, có cột giảng viên và thông tin tiết.
- RMIT: https://www.rmit.edu.au/students/my-course/class-timetables/he-guide — hướng dẫn xem giờ/địa điểm và loại hoạt động theo lớp, xem lịch cá nhân.

Chỉ tham khảo cách tổ chức thông tin công khai. Không dùng tài khoản trường, không lấy mã nguồn, nhận diện hoặc sao chép bố cục. Không áp dụng khung tiết/quy tắc nghỉ riêng của trường khác vào dữ liệu Lac Hong.

## Dữ liệu và kiểm chứng

Bổ sung duy nhất bảng mở rộng `schedule_periods`, liên kết buổi học và tự xóa theo buổi. Không sửa 36 bảng SQL tham chiếu. Migration tự chạy, có thể chạy lại. Dữ liệu cũ giữ số lượng người dùng, sinh viên, đăng ký, buổi học, giáo viên và kỳ thi; bảng tiết mới trống cho tới khi cán bộ khai báo. Dữ liệu demo mới có cấu hình 3 tiết × 45 phút + 15 phút nghỉ cho các buổi 150 phút để minh họa.

205/205 kiểm thử tự động đạt. Bao gồm lịch sinh viên/giảng viên đồng bộ, nhiều giáo viên, validation và rollback, đổi giờ không khớp, lịch chưa khai báo, xóa buổi/cấu hình con, chạy lại migration và quyền ghi. Kiểm tra local 7/7, audit nguồn và build đạt.

Chromium: rà 35 trang tại 1440/768/390/320 px, 140 lượt không phát hiện tràn ngang toàn trang, lỗi JavaScript hay HTTP 5xx. Luồng thật: sửa tiết/loại buổi, xem cảnh báo khi không khớp, lưu, đối chiếu lịch sinh viên và giảng viên; thử lịch tuần/danh sách/lọc lớp và thẻ điện thoại. Migration V06.19 → V06.20 thử hai lần trên bản sao dữ liệu và không tự sinh tiết cho lịch cũ.

Chưa xác nhận trực tiếp Windows/Edge/Safari, MySQL hay mô hình AI thật. Đây là kiểm tra local với SQLite và Chromium/Linux, không phải chứng nhận mọi tổ hợp nghiệp vụ.

## Nâng cấp

Dừng ứng dụng cũ, sao lưu `backend/data` và `.env`. Giải nén, chuyển dữ liệu/cấu hình đang dùng sang bản mới rồi chạy `npm ci`, `npm run dev`. Mở http://localhost:5173. Không xóa dữ liệu để xem tính năng mới; cán bộ có thể sửa buổi cũ và nhập tiết. Tài khoản demo cb001/gv001/20240001/quantri; mật khẩu Hocvu@2026.
