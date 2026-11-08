# Lac Hong University — Cải tiến cổng sinh viên V06.18

Ngày 08/11/2026. Kế thừa đầy đủ nghiệp vụ V06.17; không thay cấu trúc dữ liệu hoặc bộ SQL tham chiếu 36 bảng.

## Tham khảo và quyết định thiết kế

Chỉ sử dụng trang công khai và tài liệu chính thức. Không truy cập tài khoản sinh viên các trường. Không lấy HTML/CSS, ảnh, logo, nội dung thông báo hay bố cục nguyên mẫu của trường khác vào sản phẩm.

| Nguồn chính thức | Điều quan sát được | Áp dụng trong Lac Hong |
| --- | --- | --- |
| UIT — chuyên mục sinh viên | Phân loại thông báo, lối truy cập nhanh tới dịch vụ | Tách dịch vụ và việc cá nhân; không nhập thông báo UIT |
| NUS — hướng dẫn EduRec có ảnh trang chủ | Nhóm thao tác học tập, tài chính và thông tin cá nhân thành ô chức năng | Danh mục dịch vụ gọn, biểu tượng và mô tả ngắn do dự án tự thiết kế |
| UQ — hướng dẫn mySI-net | Tách Tasks/Messages, Enrolments, Financials và Personal Details theo nhu cầu | Việc cần ưu tiên riêng, dịch vụ tìm không dấu và đường dẫn hồ sơ cá nhân |
| Stanford — tài liệu Axess/Student Services | Tập trung nghiệp vụ học tập, hồ sơ và tài chính | Giữ dịch vụ trong một cổng, dẫn thẳng tới chức năng hiện có |

Nguồn:

- https://portal.uit.edu.vn/chuyen-muc/sinh-vien
- https://www.nus.edu.sg/registrar/docs/default-source/prospective-students---non-graduating/instructions-for-epayment.pdf?sfvrsn=866e6f0c_66 (tài liệu sửa 19/09/2025)
- https://my.uq.edu.au/information-and-services/information-technology/it-training/mysi-net-student-guide
- https://studentservices.stanford.edu/more-resources/access-systems-suid-sunet-axess

Nguồn tham khảo hỗ trợ cách tổ chức thông tin, không chứng minh giao diện sau đăng nhập hiện tại của tất cả các trường. Trang/tài liệu công khai có thể thay đổi.

## Những gì đã nâng cấp

- Bố cục Student Hub riêng: lời chào gọn, danh tính, buổi kế tiếp, chỉ số học tập, danh mục dịch vụ, việc cần ưu tiên, tiến độ và thời gian đăng ký. Dùng lại nhận diện chim Lạc/sách và bảng màu riêng của dự án.
- Tìm trong tám dịch vụ bằng tên/mô tả, hỗ trợ không dấu; không tìm thấy có hướng dẫn. Đường dẫn hồ sơ tự lấy mã hồ sơ người đang đăng nhập. Tìm kiếm không gọi AI hay gửi dữ liệu ra ngoài.
- Việc cần ưu tiên: yêu cầu cần bổ sung, khoản thu còn thiếu sau khi trừ phiếu thu đang hiệu lực, lịch thi đã công bố của lớp đang học. Bỏ dữ liệu người khác, lịch thi nháp/đã qua và khoản đã trả. Đặt quá hạn/cần bổ sung trước, sau đó theo hạn gần. Hiển thị tối đa bốn mục; mỗi mục dẫn tới nghiệp vụ đầy đủ. Không tạo thông báo nhà trường giả.
- Buổi kế tiếp trong 14 ngày: bỏ buổi đã kết thúc, phân biệt đang diễn ra/tiếp theo hôm nay/buổi tiếp theo. Dùng giờ Việt Nam và lịch đã được cấp quyền.
- Lịch tuần bấm từng ngày để lọc buổi, có nút Cả tuần, trạng thái được chọn và nhãn trợ năng. Áp dụng cho cả lịch tổng quan giảng viên. Chọn ngày ngoài tuần không làm lịch mất dữ liệu.
- Trạng thái đăng ký: chưa cài mốc/sắp mở/đang mở/đã đóng; hiển thị giờ Việt Nam. Đây là thông tin hướng dẫn; máy chủ vẫn kiểm tra thời hạn/điều kiện thật khi gửi đăng ký.
- Giữ vị trí con trỏ khi sửa từ khóa trong ô tìm kiếm; giữ focus sau khi chọn ngày. Giao diện tự đổi cột trên điện thoại, máy tính bảng và màn hình rộng.

## Kiểm chứng

196/196 kiểm thử tự động đạt, trong đó có kiểm thử mới về giới hạn dữ liệu sinh viên, phiếu thu đã hủy, thứ tự hạn, tìm không dấu/escape HTML, múi giờ Việt Nam, cửa sổ đăng ký và chọn ngày lịch. Các kiểm thử nghiệp vụ cũ tiếp tục chạy.

Chromium: rà 30 trang chính của bốn vai trò ở 1440/768/390/320 px (120 lượt), không phát hiện tràn ngang, lỗi JavaScript hoặc HTTP 5xx trong đợt rà. Đã thử trực tiếp tìm dịch vụ, trạng thái không có kết quả, phục hồi danh sách, chọn ngày/Cả tuần, menu và chatbot trên điện thoại. Kiểm tra local 7/7 mục; audit nguồn và build đạt.

Kiểm thử không đồng nghĩa mọi tổ hợp nghiệp vụ đã thử thủ công. Chưa chạy trực tiếp Windows/Edge/Safari, MySQL hay mô hình Gemini/Ollama thật. Các mục chỉ lấy dữ liệu sẵn có trong phạm vi tài khoản; không bổ sung CMS thông báo, email trường hoặc hệ thống thư viện giả.

## Chạy và giữ dữ liệu

Dừng ứng dụng cũ, sao lưu `backend/data` và `.env`. Giải nén bản mới, đưa dữ liệu/cấu hình đang dùng sang bản mới nếu cần giữ hồ sơ. Chạy `npm ci`, `npm run dev`, mở http://localhost:5173. Tài khoản demo 20240001 (sinh viên), gv001 (giảng viên), cb001 (cán bộ), quantri (quản trị); mật khẩu Hocvu@2026.

Bản này không có migration mới. Không đổi mật khẩu, khóa phiên hay API chỉ để đổi giao diện. ZIP không chứa dữ liệu cá nhân, .env, node_modules, dist hoặc ảnh chụp kiểm thử.
