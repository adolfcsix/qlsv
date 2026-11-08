# Báo cáo hoàn thiện và rà soát QLSV V06.14

Ngày 08/11/2026. Nền: V06.13.2 đã sửa lỗi trang trắng và lỗi luồng dữ liệu học vụ. Mục tiêu: chức năng local cho cán bộ/sinh viên, giao diện rõ và giữ dữ liệu lịch sử.

## Đối chiếu yêu cầu

| Yêu cầu | Đã thực hiện |
|---|---|
| Tràn giao diện tổng kết/xét tốt nghiệp và các phần khác | Sửa card dùng chung có vùng thân và padding, biểu mẫu label/select xếp dọc, min-width 0 và cột minmax, nút có chữ dùng small thay icon-btn, nhóm thao tác xuống dòng, bảng cuộn trong khối, sửa bố cục ảnh và thẻ lớp |
| Thêm sinh viên có thể có/không ảnh | File picker, xem trước, nén, lưu cùng giao dịch; cán bộ thay/gỡ; ảnh hiển thị danh sách/hồ sơ; backend chặn sinh viên sửa và kiểm tra quyền đọc |
| CRUD khóa, khoa, ngành, lớp | Giữ writer/API danh mục đã có, đưa lối vào nhanh lên tổng quan/trang điều phối, nút Sửa/Xóa có chữ; sửa ánh xạ ID và cố vấn ở danh sách lớp; bảo vệ bản ghi còn quan hệ |
| Sĩ số tối đa lớp hành chính | Cấu hình khi tạo/sửa, chặn thêm/chuyển/khôi phục sinh viên vào lớp đầy và chặn giảm dưới sĩ số đang quản lý |
| Quản lý lớp học phần | Mở/sửa sĩ số, trạng thái, giảng viên phụ trách; xóa lớp trống hoặc hủy lớp đã dùng, giữ lịch sử |
| Cán bộ xếp thời khóa biểu | Màn hình điều phối riêng; nhiều buổi theo thứ/giờ/ngày hiệu lực/phòng; sửa/xóa có kiểm tra và nhật ký |
| Thêm/sửa/xóa giáo viên vào tiết | Mỗi buổi chọn nhiều giảng viên hoặc không phân công; cập nhật lịch giảng viên và phạm vi sổ điểm/lớp được phân công |
| Đối tượng theo lớp/khóa/khoa/ngành cho tiết | Gán/gỡ phạm vi ở toàn lớp hoặc riêng buổi; mở rộng thành lớp hành chính thật; đồng bộ sinh viên tùy chọn; lịch và snapshot lọc theo đối tượng thực |
| Sinh viên đăng ký, cán bộ chấp thuận | Trạng thái pending/approved/rejected/cancelled; chưa duyệt chưa chiếm chỗ/chưa có lịch; duyệt kiểm tra lại và giao dịch; sinh viên thấy lý do và rút yêu cầu pending |
| Thêm chay đích danh và nhận biết khác lớp | Cán bộ thêm/gỡ có căn cứ; giữ lớp hành chính của hồ sơ, nhãn Học ghép / khác lớp trên roster và lịch; nguồn phân trực tiếp/duyệt được thể hiện |
| Rà lại tổng thể | 146/146 kiểm thử; 7/7 local; build và audit nguồn đạt; kiểm tra module HTTP, dữ liệu và luồng giao diện + API thật |

## Thiết kế dữ liệu

Không sửa nội dung `backend/database/qlsv-original.sql` (36 bảng lõi). Migration mới thêm 8 bảng: group_settings, student_photos, section_targets, schedule_teachers, enrollment_requests, schedule_options, schedule_audience_modes, schedule_audiences. Tự tạo khi khởi động và chạy lại không xóa dữ liệu.

Ảnh nằm trong CSDL bổ trợ, không phải tệp công khai và không ghi base64 vào audit. Chỉ có URL đọc có kiểm tra phiên/quyền được đưa vào snapshot. Ảnh đầu vào được thu nhỏ/nén ở frontend; backend kiểm tra dung lượng, base64 và magic header của JPEG/PNG/WebP.

Đăng ký pending tách khỏi enrollments để không làm sai lịch, điểm hay sĩ số. Cả endpoint đăng ký cũ của sinh viên cũng chuyển sang chờ duyệt; endpoint changes không còn cho sinh viên ghi enrollment trực tiếp. Các đăng ký có từ bản cũ được giữ.

Hủy lớp/gỡ sinh viên giữ các bản ghi lịch sử. Không xóa/hủy lớp hoặc gỡ người đã có kết quả công bố. Các thay đổi lịch, danh mục, ảnh và danh sách có transaction, revision/audit tương ứng. Khi duyệt đăng ký, điều kiện được đọc lại trong transaction để tránh tranh chỗ.

## Các nhóm kiểm thử mới

1. Chặn sinh viên/giảng viên/quản trị ghi điều phối; giữ quyền cán bộ đào tạo.
2. Thêm ảnh tùy chọn, thay/gỡ ảnh, chặn SVG và truy cập hồ sơ ngoài phạm vi, rollback khi ảnh lỗi.
3. Sĩ số lớp hành chính và việc không tạo dở hồ sơ/ảnh khi đầy lớp.
4. Tạo lớp học phần, lịch nhiều giảng viên, bỏ/thêm phân công và lịch giảng viên thực tế.
5. Trùng phòng/giảng viên, ngày/giờ không hợp lệ, revision cũ, giới hạn sức chứa.
6. Gán phạm vi nhóm/khóa/khoa/ngành và lọc lại lớp đã gán.
7. Pending chưa có enrollment/lịch, rút và từ chối có lý do, chặn gửi hộ/tự duyệt/duyệt lặp.
8. Thêm đích danh, đánh dấu học ghép, duyệt vào lớp, giảm sĩ số bị chặn, gỡ khỏi lịch.
9. Đối tượng riêng từng buổi: gán/gỡ nhóm làm lịch và snapshot sinh viên thay đổi đúng; reset dùng danh sách chung.
10. Phân cả nhóm hết chỗ giữa chừng: rollback toàn bộ, không để một phần sinh viên được gán.
11. Xóa buổi cập nhật lịch; xóa lớp trống và hủy lớp có lịch sử; migration chạy lại giữ dữ liệu.
12. Ca controller/forms/actions với HTTP thật và DOM giả lập: mở lớp → thêm buổi → thêm đích danh → sinh viên gửi → cán bộ duyệt; thực hiện liên tiếp không reload, kiểm tra roster và CSDL.
13. Ca tranh chỗ trước đây đã cập nhật theo luồng duyệt: hai yêu cầu đều pending, chỉ một lượt duyệt thành công khi còn một chỗ.
14. Toàn bộ kiểm thử cũ về phân quyền, CSRF, điểm, chương trình, tổng kết, tài chính và AI giả lập tiếp tục đạt.

## Kết quả

- `npm test`: 146/146 đạt, không skip.
- `npm run check:local`: 7/7 đạt, SQLite trong RAM.
- `npm run audit:source`: 195 source files, không import/CSS mất đích, nguồn mồ côi, file cũ hay file trùng.
- `npm run build`: đạt, có module shared trong đầu ra tĩnh.
- Đã sao lưu một SQLite của bản trước, chạy migration và seed rồi khởi tạo lại: giữ nguyên 6 tài khoản, 8 sinh viên và 10 lần đăng ký, đủ 8 bảng mới.
- Đóng gói không gồm `.env`, DB của quá trình chạy thử, node_modules hoặc dist; không thêm bản code cũ dự phòng.

## Phạm vi chưa kiểm chứng và giới hạn

- Chưa xác nhận E2E/ảnh chụp trực quan trên Chrome/Edge/iPhone. Đã thử cài Chromium Headless Shell nhưng gói tải về không phải archive hợp lệ. Test DOM giả lập không được coi là kiểm thử trình duyệt hay đo pixel/scroll thực tế.
- Chưa chạy MySQL thật hoặc Gemini/Ollama thật. Không có khóa/mô hình trực tiếp trong môi trường; không thay đổi trạng thái kiểm chứng AI của bản trước.
- Xếp lịch theo buổi lặp và khoảng ngày hiệu lực; chưa có lịch nghỉ/học bù riêng, chưa quản lý phân công coi thi. Không coi việc kiểm tra trùng buổi học là xác nhận đầy đủ mọi xung đột lịch thi.
- Gán phạm vi rộng không vượt qua chương trình, tiên quyết, tín chỉ hay sức chứa. Phân toàn khoa/khóa có thể cần nhiều lớp học phần; không tự bỏ qua người không đủ điều kiện.
- Đối tượng riêng từng buổi là các lớp hành chính, có thể chọn qua khóa/khoa/ngành. Người học ghép ngoài đối tượng chung vẫn được dự các buổi của lớp đã được cán bộ duyệt/phân trực tiếp. Gỡ đối tượng riêng không xóa đăng ký học phần.
- Giữ ranh giới học vụ: quyết định tốt nghiệp/tổng kết chính thức vẫn cần quy chế trường, không tự sinh quyết định chính thức.

Hướng dẫn thao tác và cập nhật dữ liệu: `HUONG_DAN_CAN_BO_V06_14.md`.
