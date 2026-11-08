# Báo cáo rà soát UI/UX Local — QLSV V06.13.1 (bản điều chỉnh)

## Phạm vi

- Nền kiểm tra: gói `QLSV_V06_13_1_GEMINI_BAN_DAY_DU_DA_SUA.zip` đã sửa đủ tệp database.
- Giữ frontend HTML/CSS/JavaScript ES Modules, backend Node.js, giao diện 4 vai trò, SQL và cấu hình Gemini. Không thay nghiệp vụ điểm, tuyển sinh, học vụ.
- Đã đọc mã giao diện theo menu vai trò, `layout`, CSS nguồn, chatbot, biểu mẫu, routes và xử lý tương tác; kiểm tra HTTP Local và chạy suite tự động.
- **Chưa thể xác nhận chất lượng hiển thị bằng ảnh chụp màn hình trình duyệt.** Chromium trong môi trường này trả `net::ERR_BLOCKED_BY_ADMINISTRATOR` khi truy cập cả localhost và file. Không được hiểu kết quả test nguồn là kết quả kiểm tra trực quan/E2E.

## Vấn đề tìm thấy và đã chỉnh

| Khu vực | Vấn đề nhận thấy trong source trước khi sửa | Thay đổi | Tệp |
| --- | --- | --- | --- |
| Typography desktop | Một số nhãn điều hướng, nút, bảng nhỏ 10–11.5px | Tăng kích thước nhãn chính, nút, bảng, biểu mẫu | `frontend/src/styles/responsive.css` |
| Typography điện thoại | Nhiều nhãn/form/card/chú thích 7.5–11px, khó đọc trên màn hình nhỏ | Chuẩn hóa cỡ chữ và line-height cho các phần có nội dung chính | `responsive.css` |
| Điều khiển mobile | Nhiều nút 29–40px, vùng chạm nhỏ | Nâng vùng chạm cho nhóm nút chính và chat | `responsive.css` |
| Chatbot điện thoại | Chừa khoảng trống 83px bên dưới mặc dù nút launcher bị ẩn; nút phóng to không có tác dụng ở chế độ toàn màn hình | Dùng vùng hiển thị an toàn theo safe-area, bỏ nút phóng to trên điện thoại | `responsive.css`, `features/chatbot/chat-panel.js` |
| Danh sách học vụ | Bảng dài, bộ lọc và tabs có nguy cơ ép nội dung trên màn hình hẹp | Cho bảng/tab cuộn ngang cục bộ; bộ lọc và nút xuống dòng | `responsive.css` |
| Điện thoại 320–360px | Hai thẻ KPI đặt cạnh nhau làm chữ và số chật | Xếp KPI một cột ở màn hình rất hẹp | `responsive.css` |

Các chỉnh sửa được viết **một lần** tại `responsive.css`, được tải sau `generated.css` qua `main.css`; **không** chỉnh trực tiếp `generated.css` hoặc tạo một hệ component thứ hai. Không sao chép xử lý chatbot. Việc tăng font có thể làm thay đổi chiều cao bảng/thẻ; cần xem lại thực tế trên máy giáo viên.

## Kết quả đã kiểm tra

- `npm test`: **121/121 đạt** (116 bài cũ, 5 bài smoke UI mới).
- `npm run check:local`: **7/7 đạt** bằng SQLite demo và HTTP local; không phải MySQL thật.
- `npm run build`: thành công.
- `npm run audit:source`: không phát hiện import hỏng, file nguồn bị bỏ quên hoặc trùng **nguyên nội dung**; `frontend/src/services/repository.js` còn là lớp tương thích có sử dụng.
- `GET /` và các tệp giao diện được kiểm tra qua HTTP trả `200`.
- **Không kiểm chứng** E2E click, bố cục pixel thực, mọi modal, responsive của thiết bị thật, Gemini API thật và MySQL thật.

## Checklist bắt buộc trên máy Windows trước khi bảo vệ

Dùng Chrome/Edge, mở `http://localhost:5173`, kiểm tra ở **1440px**, **768px**, **390px**, **320px**:

1. **Đăng nhập:** form, ẩn/hiện mật khẩu, lỗi đăng nhập, 4 nút tài khoản mẫu; đăng nhập/đăng xuất cho 4 vai trò.
2. **Menu:** mở/đóng mobile, chọn từng trang, xem mục active, không có menu trùng, nhấn Escape để đóng.
3. **Cán bộ:** bộ lọc khóa → khoa → ngành → chương trình → lớp; thêm/sửa/xóa dữ liệu mẫu; bảng cuộn và phân trang; lịch học; sổ điểm; cảnh báo; xét tốt nghiệp.
4. **Giảng viên:** lớp được phân công, nhập điểm nháp, lịch giảng dạy, lớp cố vấn và kỳ thi.
5. **Sinh viên:** kế hoạch học, đăng ký, giỏ lớp, lịch tuần, kết quả đã công bố, yêu cầu học vụ.
6. **Quản trị:** tài khoản, khóa/mở, nhật ký; không nhìn thấy các phân hệ vượt quyền.
7. **Chatbot:** mở/đóng, nhập câu hỏi, trạng thái chờ, lỗi khi thiếu key; sau khi có key bấm “Kiểm tra AI thật”, kiểm tra tool calling và phân quyền. Không dùng kết quả dữ liệu giả để nhận là AI thật.
8. **UI:** không bị mất nút thao tác, không có text cắt mất nghĩa, bảng chỉ cuộn bên trong, không có thanh cuộn ngang ở toàn bộ trang; test bàn phím Tab/Enter/Escape.

### Giới hạn đánh giá

Bản này đã sửa **một nhóm lỗi khả năng sử dụng có thể xác định từ mã nguồn**. Không thể kết luận “toàn bộ UI/UX đã đẹp, không lỗi, hoàn thiện” khi chưa xem trên trình duyệt thực tế. Nếu có lỗi phát sinh sau khi chạy Chrome ở máy bạn, cần sửa đúng màn hình và kiểm thử hồi quy; không thêm file CSS cũ hoặc bản sao `app.js`/`pages.js`.
