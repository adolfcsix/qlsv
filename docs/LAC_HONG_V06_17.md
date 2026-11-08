# Lac Hong University — Nhận diện, trải nghiệm và ổn định V06.17

Ngày 08/11/2026. Kế thừa đầy đủ bản V06.16.

## Nhận diện

Tên hiển thị Lac Hong University / Lạc Hồng. Biểu tượng gốc kết hợp chim Lạc vươn lên và sách mở, dùng SVG để sắc nét trên mọi kích thước. Logo trong sidebar, đăng nhập, favicon và chatbot cùng hình học. Tệp biểu tượng độc lập ở `frontend/assets/brand/lac-hong-mark.svg`; wordmark được kết xuất từ `frontend/src/components/brand.js`. Xanh #122e59, xanh nhấn #254e87, vàng #e8c781, nền #f4f6fb. Font hệ thống hỗ trợ tiếng Việt; không cần tải font/CDN khi chạy.

Nhận diện được thiết kế riêng cho đồ án, không phải bản sao logo trường thật. Đăng nhập có minh họa khu học xá vector đồng bộ. Dữ liệu tài khoản mẫu, khóa lưu phiên và địa chỉ email mẫu cũ được giữ để tương thích; chúng không phải tên thương hiệu đang hiển thị.

## Cổng sinh viên

Trang tổng quan gồm lời chào theo hồ sơ, mã sinh viên/lớp/trạng thái, bốn lối tắt, số tín chỉ đã đạt, GPA được tổng kết, học phí còn thiếu, lịch tuần với phân công giáo viên từng buổi, tiến độ chương trình và lớp đang học. Số liệu lấy từ dữ liệu người dùng được phép xem. Không giả GPA khi chưa có tổng kết được duyệt; không tính phần trăm khi chưa có tổng tín chỉ. Lịch tuần thể hiện tối đa năm buổi và liên kết tới thời khóa biểu đầy đủ.

Các thẻ học phần chỉ hiện lớp đã đăng ký/đang học. Yêu cầu cần bổ sung, công nợ và kết quả dùng các luồng nghiệp vụ hiện có. Hồ sơ không có lớp/lịch có trạng thái rỗng rõ ràng. Bảng, danh sách, tiêu đề, nút và menu trong các trang cá nhân thống nhất nhận diện; màn hình nhỏ tự đổi số cột.

## Cổng giảng viên

Tổng quan riêng cho giảng viên: các lối tắt lớp, sổ điểm, cố vấn và lịch thi; số lớp, sinh viên cố vấn, dòng điểm chưa công bố; lịch tuần; việc cần xử lý; thẻ lớp học. Thẻ lớp mở đúng sổ điểm của lớp đó. Dòng điểm nháp chỉ đếm trong lớp được giao. Dữ liệu lịch và giáo viên theo từng buổi, không lấy giáo viên mặc định khi buổi đã bỏ phân công.

## Kiểm tra

- 189/189 kiểm thử tự động đạt: backend, phân quyền, nghiệp vụ cũ, quản trị và cổng mới; có kiểm tra tên chứa HTML, tiến độ thiếu dữ liệu, điểm nháp theo lớp và giáo viên theo buổi.
- Chromium: rà 30 trang chính thuộc bốn vai trò ở chiều rộng 1440, 768, 390, 320 px (120 lượt). Không phát hiện tràn ngang toàn trang, lỗi JavaScript hay phản hồi HTTP 5xx trong đợt kiểm tra.
- Đã xem trực quan trang đăng nhập, tổng quan sinh viên/giảng viên, điện thoại và chatbot; kiểm tra menu điện thoại. Sửa lỗi logo làm vỡ nút chatbot và đồng bộ màu cửa sổ chat.
- Kiểm tra local 7/7 mục; audit nguồn và build đạt. Tệp SQL tham chiếu 36 bảng giữ nguyên.

Đây là kiểm chứng trên Chromium/Linux và SQLite. Chưa chạy trực tiếp Windows/Edge/Safari, MySQL hay mô hình Gemini/Ollama thật. 120 lượt trình duyệt là kiểm tra bố cục/điều hướng và lỗi chạy; không đồng nghĩa mọi tổ hợp nghiệp vụ đều được thử thủ công.

## Cài đặt và nâng cấp

1. Sao lưu dữ liệu/cấu hình trước khi nâng cấp; dừng phiên ứng dụng cũ.
2. Giải nén thư mục Lac Hong University mới, mở bằng VS Code.
3. Nếu giữ dữ liệu, chép `backend/data` và `.env` đang dùng vào bản mới. Không đưa dữ liệu demo đè dữ liệu thật.
4. Chạy `npm ci`, `npm run dev`; truy cập http://localhost:5173.
5. Tài khoản demo sinh viên 20240001, giảng viên gv001, cán bộ cb001, quản trị quantri; cùng mật khẩu Hocvu@2026. Cấu hình AI thật theo hướng dẫn AI hiện có nếu cần.

Bản này không bổ sung migration CSDL. Các chức năng quản trị tài khoản, nhân sự, học kỳ, phòng và nghiệp vụ đào tạo của V06.16 được giữ. ZIP không chứa dữ liệu cá nhân, `.env`, node_modules, bản build hoặc ảnh chụp kiểm thử.
