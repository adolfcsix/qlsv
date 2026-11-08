# Đối chiếu QLSV V06.12 với cơ sở dữ liệu và tài liệu nghiệp vụ

Nguồn: `QLSV(3).docx`, `qlsv_1(1).txt` người dùng gửi ngày 07/11/2026. Bảng `qlsv-original.sql` giữ nguyên 36 bảng lõi.

| Nhóm | Thực trạng V06.12 | Còn thiếu/cần xác nhận |
|---|---|---|
| Tài khoản / phân quyền | Đăng nhập, cookie, CSRF, quyền bốn nhóm | Phân quyền chi tiết theo đơn vị và kiểm thử tải |
| Khoa–ngành–khóa–chương trình–lớp | API lọc, CRUD có ràng buộc, màn hình riêng | Quản trị chính sách phiên bản nâng cao |
| Chương trình & học phần | Gán học phần bắt buộc/tự chọn, định mức nhóm, tiên quyết, chặn vòng; có tạo và duyệt phiên bản sao chép, không đổi dữ liệu cũ | Chưa phiên bản hóa tiên quyết riêng theo chương trình; quy chế cần xác nhận |
| Tiến độ hoàn thành | Tính từ kết quả công bố và quyết định công nhận tương đương đang hiệu lực, không cộng tín chỉ trùng | Công nhận tương đương chưa quy đổi GPA; chưa tự quyết định tốt nghiệp |
| Hồ sơ sinh viên | Danh sách, hồ sơ, biến động có quyết định | Các quy trình học vụ nhiều cấp |
| Lớp và đăng ký | Lớp học phần, lịch nhiều buổi, kiểm soát đăng ký/hủy/rút | Nâng cao xử lý thi bù, chuyển lịch và giao dịch đông người |
| Bảng điểm | Sổ điểm, công bố, sửa sau duyệt, nguồn điểm | Trình tự duyệt điểm nhiều cấp theo quy chế trường |
| `semester_summaries` | **Mới V06.9:** tính từ lần học đã công bố, bản nháp, phiên bản duyệt hiện hành, nguồn và quy tắc có thể truy vết | Chỉ có chính sách DEMO-01; cần xác nhận quy chế trường và thử MySQL |
| `academic_warnings` | **Mới V06.9:** lập nháp khi thỏa ngưỡng đã cấu hình, duyệt quyết định, thu hồi có lý do | Ngưỡng trường thật, kỳ bảo lưu, quy trình hội đồng và thông báo chính thức |
| Rèn luyện, xét tốt nghiệp | Có hồ sơ xét dạng nháp/duyệt/từ chối, quyết định xét và xác nhận chứng từ thủ công | Chưa có quy trình cấp bằng, trạng thái tốt nghiệp theo quyết định có hiệu lực và quy chế chính thức |
| Chatbot / tài chính | Phần mở rộng riêng của V05, không thuộc phạm vi 36 bảng lõi | Xác minh API mô hình, thanh toán và dữ liệu thật |

**Quy tắc cần giữ:** lớp hành chính khác lớp học phần; học lại khác thi lại; điểm trống khác 0; tín chỉ không cộng hai lần; GPA chính thức chỉ xuất hiện khi có tổng kết được duyệt; cảnh báo chưa duyệt không hiển thị cho sinh viên. Các ngưỡng và công thức trong DEMO-01 không phải quy chế trường.

## Đối chiếu bổ sung V06.12

- **Phiên bản chương trình:** bản mới nằm ở `curricula` với mã riêng; bảng `curriculum_versions` chỉ quản lý quan hệ và trạng thái duyệt, không thay đổi dữ liệu cũ.
- **Công nhận học phần tương đương:** bảng mở rộng `credit_recognitions` lưu kết quả nguồn, môn đích và số quyết định, nhưng chưa tính GPA theo quy chế chưa ban hành.
- **Xét tốt nghiệp:** `graduation_reviews` lưu trạng thái hồ sơ và căn cứ; bản đã duyệt liên kết với `student_decisions` loại `graduation_review`; không tự đánh dấu tốt nghiệp.
- **Chưa được xác nhận:** quy chế tốt nghiệp thực tế, chính sách công nhận học phần và quy đổi điểm; quy trình cấp văn bằng, MySQL thực, trình duyệt thật.
