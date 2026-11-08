# Lac Hong University V06.19 — Tinh chỉnh giao diện và bàn làm việc cán bộ

Ngày 08/11/2026. Kế thừa đầy đủ nghiệp vụ V06.18. Không có migration mới, không thay API, mật khẩu hay cơ chế phân quyền.

## Những gì được sửa

Hệ thống nút dùng kích thước và trạng thái thống nhất: chính/phụ/xóa/đang vô hiệu, nút nhỏ trong bảng, nút biểu tượng, focus bàn phím. Bỏ hiệu ứng nhấc, giảm bo tròn, bỏ bóng đổ và nền chuyển màu trên khu làm việc/thẻ chức năng. Nhãn dài được xuống dòng có kiểm soát, biểu tượng không bị ép nhỏ. Các nút quan trọng được giữ ở nơi thao tác thực sự.

Font hệ thống hỗ trợ tiếng Việt, có Segoe UI trên Windows và Arial/Liberation Sans khi cần thay thế. Điều khiển biểu mẫu và nút kế thừa cùng font; chuẩn hóa chiều cao dòng, giảm giãn chữ, tăng cỡ chữ phụ, không dùng ép chữ hoa cho nhãn nút. Giữ dấu tiếng Việt trong tiêu đề, nhãn, trạng thái và trường nhập. Lựa chọn ngày/tệp vẫn là điều khiển gốc của trình duyệt; ngôn ngữ hiển thị phụ thuộc trình duyệt/hệ điều hành.

Thẻ dịch vụ sinh viên/giảng viên có hình thức gọn hơn, biểu tượng đồng nhất, tiêu đề trung tính; bỏ một số khẩu hiệu và câu chữ trang trí. Nhận diện Lac Hong và logo chim Lạc/sách vẫn được giữ.

Trang cán bộ được tổ chức lại:

- Tiêu đề cùng thao tác Thêm sinh viên và Xếp lịch & duyệt đăng ký.
- Chỉ số hồ sơ, lớp hành chính, lớp học phần và yêu cầu chờ xử lý.
- Hàng chờ đăng ký/yêu cầu/lịch thi nháp/điểm chưa công bố, dẫn tới nghiệp vụ hiện có.
- Tối đa năm yêu cầu mới đang chờ, sắp theo ngày gửi; ngày hiển thị tiếng Việt.
- Lịch trong tuần và tổng công nợ sau các phiếu còn hiệu lực.
- Ba nhóm điều hướng: Tổ chức đào tạo, Quản lý giảng dạy, Công tác sinh viên.

Sửa lỗi khoảng trống lớn giữa tiêu đề và nút trên điện thoại: giá trị flex-basis dùng cho chiều ngang đã vô tình tạo chiều cao tối thiểu khi đổi bố cục sang cột. Quy tắc trên màn hình nhỏ được đặt lại theo chiều cao nội dung. Biểu mẫu dài vẫn cuộn tới phần Lưu/Hủy và không tràn ngang.

## Kiểm tra

- 197/197 kiểm thử tự động đạt, gồm nghiệp vụ cũ và dữ liệu bàn làm việc cán bộ (số liệu, đường dẫn thao tác, escape tên/nội dung yêu cầu).
- Chromium: 35 trang thuộc bốn vai trò tại 1440/768/390/320 px, 140 lượt. Kiểm tra tràn ngang, lỗi JavaScript, HTTP 5xx, chữ nằm ngoài nút, font nút khác font chung và khoảng trống bất thường trước nhóm thao tác trên điện thoại.
- Biểu mẫu Thêm sinh viên: kiểm tra riêng bốn kích thước; trường nhập kế thừa font, không tràn ngang, Lưu/Hủy có thể cuộn tới. Đã xem trực quan trang cán bộ và biểu mẫu trên máy tính/điện thoại.
- Kiểm tra local 7/7; audit nguồn và build đạt. Tệp SQL tham chiếu 36 bảng được giữ nguyên.

Đây là kiểm chứng Chromium/Linux và SQLite; chưa xác nhận trực tiếp mọi trình duyệt, font của máy Windows thực tế, MySQL hoặc mô hình AI thật. Đợt rà giao diện không thay thế toàn bộ tổ hợp nghiệp vụ thủ công. Các kiểm thử API/nghiệp vụ được chạy độc lập.

## Chạy và giữ dữ liệu

Dừng ứng dụng cũ, sao lưu `backend/data` và `.env`. Giải nén bản mới, chuyển dữ liệu/cấu hình đang dùng sang bản mới nếu cần giữ hồ sơ. Chạy `npm ci`, `npm run dev`; mở http://localhost:5173. Tài khoản demo: cb001 (cán bộ), quantri (quản trị), gv001 (giảng viên), 20240001 (sinh viên); mật khẩu Hocvu@2026.

ZIP không chứa .env, dữ liệu cá nhân, node_modules, bản build hoặc ảnh chụp kiểm thử. Hướng dẫn các nghiệp vụ V06.14–18 vẫn áp dụng.
