# QLSV V06.16 — Hướng dẫn quản trị và báo cáo kiểm tra

Ngày 08/11/2026. Bản này hoàn thành bốn nhóm mở rộng quản trị: tổng quan, nhân sự, lịch học kỳ và phòng. Các chức năng tài khoản/phân vai trò, cán bộ, giảng viên, sinh viên của bản trước được giữ.

## 1. Tổng quan toàn trường

Đăng nhập `quantri`, vào Tổng quan. Lọc theo khóa tuyển sinh, khoa, ngành, lớp hành chính. Bấm Xem danh sách hoặc các chỉ số công việc để mở sinh viên, lớp học phần hay đăng ký chờ duyệt. Bộ lọc công việc phân biệt lớp chưa có buổi học và lớp cần hoàn thiện phân công. Tìm kiếm chỉ áp dụng danh sách đang xem.

Sinh viên, lớp, đăng ký và cơ cấu sinh viên theo phạm vi được chọn. Nhân sự chỉ theo khoa; tài khoản, hồ sơ chưa cấp tài khoản và phòng là số liệu toàn trường. Lớp học phần giám sát là lớp chưa hoàn tất/chưa hủy. Danh sách sinh viên dùng thông tin tối thiểu, không đưa điểm hay liên hệ cá nhân lên dashboard. Cán bộ vẫn xử lý đăng ký/xếp lịch trong trang nghiệp vụ của mình.

## 2. Giảng viên & cán bộ

Hai tab Giảng viên và Cán bộ & quản trị. Thêm hồ sơ với mã, họ tên, khoa/đơn vị; email/điện thoại không bắt buộc. Sửa hoặc tìm theo mã, họ tên, email. Hồ sơ chưa liên kết có nút Cấp tài khoản, sử dụng luồng tài khoản và vai trò hiện có. Tạo hồ sơ không tự cấp quyền đăng nhập.

Không xóa hồ sơ đang gắn tài khoản, cố vấn, giảng dạy hoặc có tham chiếu nghiệp vụ. Sửa hồ sơ không tự đổi tên đăng nhập/vai trò. Muốn đổi quyền, dùng trang Tài khoản. Hồ sơ và tài khoản có mục đích riêng, không sinh bản sao hồ sơ khi chọn hồ sơ có sẵn.

## 3. Năm học & học kỳ

Thêm/sửa/xóa năm học và học kỳ chưa sử dụng. Học kỳ phải nằm trong năm học; không cắt năm khiến học kỳ ra ngoài. Mốc mở/đóng đăng ký sử dụng giờ Việt Nam, nhập cả hai hoặc để trống cả hai khi chưa mở. Đóng đăng ký phải sau mở và không sau ngày kết thúc học kỳ. Thay đổi này có hiệu lực tại kiểm tra đăng ký trên máy chủ.

Không chuyển học kỳ đã có lớp sang năm khác. Không cắt mốc học làm mất lịch học/lịch thi; học kỳ đã công bố kết quả hoặc duyệt tổng kết được bảo vệ mốc học. Không xóa năm còn học kỳ, học kỳ còn lớp hoặc dữ liệu tham chiếu. Mọi thay đổi cần căn cứ và được ghi nhật ký.

## 4. Phòng học & phòng thi

Thêm/sửa mã, loại, sức chứa tối đa, trạng thái. Có tìm kiếm, phân trang, lọc phòng đang/ngừng sử dụng, xem lịch sử dụng. Phòng ngừng không xuất hiện trong lựa chọn xếp lịch và bị máy chủ chặn khi xếp lịch/tạo lịch thi.

Không giảm sức chứa dưới sĩ số tối đa của lớp còn lịch học/thi sắp tới; không ngừng phòng còn lịch cần sử dụng. Chuyển hoặc xử lý lịch trước khi ngừng. Chỉ xóa phòng chưa từng sử dụng. Phòng từng có lịch được đánh dấu lịch sử ngay cả sau khi chuyển buổi sang phòng khác. Dữ liệu sử dụng chi tiết hiển thị tối đa 100 buổi mỗi nhóm, theo các lịch hiện còn tham chiếu phòng; dấu đã sử dụng vẫn được giữ khi lịch chuyển đi.

## 5. Nâng cấp và chạy local

1. Dừng ứng dụng và sao lưu `backend/data` cùng cấu hình `.env` của máy.
2. Giải nén bản mới vào thư mục riêng; đưa dữ liệu/cấu hình đang dùng sang bản mới khi cần giữ dữ liệu.
3. Chạy `npm ci`, `npm run dev` tại gốc dự án. Mở http://localhost:5173.
4. Migration bổ sung bảng trạng thái phòng và dấu lịch sử; không thay bộ SQL tham chiếu 36 bảng. Chạy lại migration an toàn.

Bản ZIP không chứa dữ liệu cá nhân, `.env`, thư viện cài sẵn hoặc bản build. Khi chưa có dữ liệu, lệnh dev tạo dữ liệu demo. Tài khoản mẫu: quantri, cb001, gv001, 20240001; mật khẩu Hocvu@2026.

## 6. Kiểm chứng và phạm vi

Kiểm thử backend mới gồm phân quyền, thống kê/lọc, CRUD, dữ liệu trùng/sai, phiên và revision, bảo vệ liên kết, thời gian đăng ký, học kỳ có lịch/kết quả, phòng ngừng/sức chứa/lịch sử. Kiểm thử giao diện chạy controller và biểu mẫu với HTTP/CSDL thật trên DOM giả lập; không phải kiểm chứng trực quan.

Migration đã thử hai lần trên bản sao CSDL V06.15, giữ số lượng người dùng, sinh viên, nhân sự, đăng ký, năm học, học kỳ và phòng. Bộ kiểm tra local, audit nguồn và build cũng được chạy. Số kiểm thử cuối được ghi ở phần kết quả bên dưới.

Chưa xác nhận trực quan trên trình duyệt thật (môi trường thiếu Chromium), chưa chạy MySQL hoặc mô hình Gemini/Ollama thật. Quản trị cấu hình AI, sao lưu/khôi phục qua giao diện và cấu hình toàn hệ thống chưa nằm trong bốn nhóm của bản này.

### Kết quả

- 184/184 kiểm thử đạt.
- Kiểm tra local: 7/7 mục đạt.
- Audit 212 tệp nguồn: không thiếu import, không có bản trùng hoặc nguồn không dùng.
- Build thành công.
