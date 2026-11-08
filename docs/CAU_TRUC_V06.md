# Cấu trúc mã nguồn QLSV V06.12

**Hai tài liệu quy chiếu đã được thống nhất:** `docs/reference/QLSV_FRONTEND_V06_CAU_TRUC.txt` và `docs/reference/QLSV_BACKEND_V06_CAU_TRUC.txt`. Cấu trúc thực tế được triển khai dần; không lập file rỗng chỉ để khớp danh mục dự kiến.

## Frontend

- `frontend/src/app/`: điều hướng, phiên người dùng, quyền hiển thị, sự kiện theo trang.
- `frontend/src/layouts/`: bố cục đăng nhập và bảng điều khiển.
- `frontend/src/components/`: thành phần giao diện dùng chung; `features/`: các bộ phận phức hợp và thao tác theo nghiệp vụ.
- `frontend/src/pages/`: từng màn hình theo vai trò, trong đó `academic/organization/`, `academic/assessment/`, `academic/student-affairs/`, `student/` được tách riêng.
- `frontend/src/services/`: HTTP, truy vấn dữ liệu và cache phục vụ giao diện; không chứa SQL, bí mật hay quy tắc phân quyền.
- `frontend/src/styles/`: nguồn CSS; `generated.css` là asset biên dịch đang sử dụng, không phải file code cũ bỏ quên.
- `frontend/src/demo/`: dữ liệu mô phỏng; không mặc định được dùng thay API thật.

## Backend

- `backend/src/server.js`: mở máy chủ, `app.js`: đăng ký API và bảo vệ request.
- `backend/src/config/`, `core/`, `middlewares/`: cấu hình DB, HTTP, bảo mật phiên/CSRF và hỗ trợ giao dịch.
- `backend/src/modules/`: nghiệp vụ từng phần; `student-affairs/` hiện chứa các hàm tổng kết theo phiên bản và quyết định cảnh báo, không tạo bộ công thức lặp trong frontend.
- `backend/database/`: giữ 36 bảng SQL gốc và các mở rộng có nhãn riêng, không sửa trực tiếp bảng gốc khi làm mới giao diện.
- `shared/lookup-intents.js`: quy ước truy vấn AI dùng chung mà không làm backend import code frontend.

## Dọn code

- Tránh hai module cùng thực thi một nghiệp vụ. Mọi API mới sử dụng chung transaction và audit có sẵn.
- `npm run audit:source`: phát hiện import hỏng, file nguồn không dùng và file byte-identical. Kiểm tra tĩnh **không chứng minh không còn mọi dạng code thừa**.
- `/api/v1/state`, `/api/v1/changes` và `frontend/src/services/repository.js` vẫn đang được sử dụng. Không được xóa cho đến khi chuyển toàn bộ màn hình còn lại và chạy lại test.
- Không để các báo cáo phiên bản cũ chồng trong nguồn mới; có một báo cáo hiện hành `docs/BAO_CAO_V06_12.md` và nhật ký tóm tắt `docs/NHAT_KY_PHIEN_BAN.md`.

## Những gì chưa phải chức năng hoàn thiện

Cấu hình quy chế trường thật, quản lý đầy đủ tiên quyết/tự chọn, duyệt thi bù/thi lại nhiều bước, rèn luyện theo quy chế và ban hành quyết định tốt nghiệp có hiệu lực; kiểm thử E2E, MySQL thật, tải lớn. Xem bảng trạng thái `docs/DOI_CHIEU_QLSV.md` để tránh trình bày quá mức.
