# Backend QLSV

Node.js >=22.13, JavaScript ES modules. Cùng repository với frontend; không cần Express. Xem README ở gốc để chạy nhanh.

## CSDL mới không dùng dữ liệu mẫu

1. Tạo `.env` từ `.env.example`, `SEED_DEMO=0`; cấu hình SQLite mới hoặc MySQL mới. Không dùng file demo làm CSDL trường.
2. `npm run db:init`.
3. Điền BOOTSTRAP_ADMIN_USERNAME/EMAIL/PASSWORD và BOOTSTRAP_STAFF_USERNAME/EMAIL/PASSWORD trong `.env` (các biến tách riêng, xem file mẫu). Mật khẩu từ 12–128 ký tự, tài khoản/email khác nhau.
4. `npm run db:bootstrap`. Chỉ chạy khi chưa có người dùng; tạo ADMIN và ACADEMIC_STAFF, kèm hồ sơ cán bộ và một đơn vị khởi tạo nếu cần. Không in mật khẩu.
5. Xóa các biến BOOTSTRAP khỏi `.env`, `npm run css`, `npm start`. Đăng nhập bắt buộc đổi mật khẩu.

Quy chế/chương trình/đầu điểm cần thiết lập và phê duyệt đúng dữ liệu trường trước khi vận hành. Giao diện hiện tại chưa quản trị toàn bộ cấu hình quy chế. Công bố chính thức cần `ALLOW_OFFICIAL_PUBLICATION=1`, quy chế đã duyệt và công thức hợp lệ; cờ này không tự tạo quy chế. DEMO-01 chỉ phục vụ dữ liệu giả.

## API JSON

Prefix `/api/v1`. Phản hồi thành công `{data: ...}`, lỗi `{error:{code,message,requestId}}`. Không truyền mật khẩu trong URL. Mọi thao tác ghi cần cookie phiên, `X-CSRF-Token` từ login/me, và Origin hợp lệ nếu có.

| Method | Route | Chức năng |
|---|---|---|
| GET | `/health` | Trạng thái driver/demo/AI, không chứa bí mật |
| POST | `/auth/login` | Username/email + password; cookie HttpOnly, CSRF |
| GET | `/auth/me` | Tài khoản hiện tại + CSRF |
| POST | `/auth/logout` | Thu hồi phiên |
| POST | `/auth/password` | current/password; băm và thu hồi mọi phiên |
| GET | `/state` | Snapshot đã lọc quyền + revision |
| POST | `/changes` | Delta danh mục/hồ sơ/tài khoản/điểm/yêu cầu/thu phí, kiểm tra server |
| POST | `/enrollments` | studentId/classIds, giao dịch đăng ký |
| GET | `/enrollments/:id/exam-attempts` | Các lần dự thi, cán bộ |
| POST | `/exam-registrations/:id/score` | status/score/reason, cán bộ |
| POST | `/enrollments/:id/publish` | Công bố một kết quả, cán bộ |
| POST | `/classes/:id/publish` | Công bố cả lớp, rollback nếu thiếu điểm |
| GET | `/students` | Danh sách sinh viên phân trang, lọc và kiểm tra quyền |
| GET | `/student-groups` | Danh sách lớp hành chính theo khóa/khoa/ngành, có phân trang |
| GET | `/students/:code` | Hồ sơ theo mã và phạm vi quyền |
| GET | `/students/:code/transcript` | Kết quả đã công bố, giữ từng lần học |
| POST | `/lookup` | Công cụ tra cứu có tham số, kiểm tra quyền |
| GET | `/ai/conversations` | Lịch sử của chính người đăng nhập |
| GET | `/ai/conversations/:id` | Mở lại, tái kiểm tra quyền/nguồn dữ liệu |
| POST | `/ai/messages` | message, conversationId tùy chọn |

`/changes` nhận `{revision,changes:[{table,id,before,after}],temporaryPassword?}`. Server quyết định actor, quyền, ID mới, mã phiếu, giá trị nghiệp vụ và quan hệ; không lưu nguyên object client. Revision khác trả 409 và yêu cầu tải lại; không tự ghi đè dữ liệu mới. Không có endpoint chạy SQL tùy ý.

## Nghiệp vụ tổng kết & cảnh báo (V06.9)

Các API mới (`/academic-semesters`, `/semester-summaries`, `/semester-summaries/preview`, `/semester-summaries/:id/approve`, `/academic-warnings`, `/academic-warnings/:id/approve`, `/academic-warnings/:id/revoke`) được đặt ở `src/modules/student-affairs/`. Đều dùng session, CSRF cho request ghi, kiểm tra vai trò và audit.

Bản nháp tổng kết chỉ do cán bộ lập và duyệt. Không được tính khi thiếu nguồn điểm đã công bố, học phần ngoài chương trình chưa có quyết định tương đương, hoặc thiếu `summaryRules`. Sinh viên chỉ nhận **bản duyệt hiện hành**. Cảnh báo chỉ công bố khi từ bản tổng kết duyệt, thỏa ngưỡng `warningRules` và có số quyết định. Các ngưỡng được seed là **minh họa**, không dùng làm quy chế trường thật.

## Tổ chức mã nguồn và tương thích

`src/server.js` chỉ mở máy chủ; `src/app.js` khai báo route; `config/`, `core/`, `middlewares/`, `modules/` chịu trách nhiệm tương ứng. Trong `modules/`, mã xử lý được chia thành `auth`, `accounts`, `organization`, `students`, `teaching`, `enrollments`, `assessment`, `exams`, `finance`, `requests`, `reports`, `audit` và `ai`.

Hai endpoint `/state` và `/changes` **vẫn đang được dùng bởi frontend**; không xóa cho đến khi các màn hình chuyển sang API theo tài nguyên và chạy kiểm thử. Các tệp gốc như `backend/src/mutations.js`, `state.js`, `results.js`, `assistant.js` đã được thay bằng module thực sự, không được giữ thêm bản sao. Có thể chạy `npm run audit:source` từ thư mục gốc để kiểm tra import hỏng, file trùng hoặc file nguồn không được sử dụng.

## Giao dịch

SQLite BEGIN IMMEDIATE và FK bật; MySQL transaction/khóa hàng `app_lock FOR UPDATE`. Các luồng quan trọng đọc và ghi trong cùng giao dịch. Khóa toàn cục phù hợp bản tích hợp nhỏ, làm giảm khả năng song song; cần thiết kế khóa hẹp hơn và load test trước triển khai lớn. Bộ giới hạn request và hàng đợi hiện nằm trong một tiến trình.

## Công bố và tính điểm

Cần tổng trọng số 100%, đủ điểm, thang tối đa hợp lệ, điều kiện dự thi đã xác nhận. Quy tắc chọn lần thi phải được cấu hình; DEMO dùng latest_attended. Ghi course_results, nguồn result_components, audit và trạng thái enrollment trong cùng giao dịch. Kết quả đã công bố khóa sửa trực tiếp. UI lấy trọng số và thang tối đa từ assessmentMeta của backend; chưa hỗ trợ chỉnh sửa mọi cấu trúc đánh giá tùy ý.

Nhập điểm thi thao tác trên lần dự thi đã tồn tại, không tự thêm thi lại/thi bù hoặc phê duyệt hoãn thi. Danh sách dự thi và điều kiện được seed để thử; cần hoàn thiện luồng quản trị trước dữ liệu thật.

## AI

Intent được giới hạn: cohort_classes, class_students, student_profile, student_transcript, student_search, unpaid, unassigned, summary, help. Tham số SQL bind; quyền từ phiên, không từ model. Kết quả trả bảng/cột/filters/sources/asOf/links; giới hạn 100 dòng và COUNT tổng. Tìm tên SQLite dùng hàm bỏ dấu; MySQL phụ thuộc collation utf8mb4 không phân biệt dấu phù hợp.

Chưa có khóa LLM -> local_lookup; có khóa -> ai_tools. Adapter chỉ gọi HTTPS, timeout 20 giây, lỗi provider được báo rõ. Không fallback âm thầm giả rằng đã dùng LLM.

## Chuyển đổi SQLite từ bản cũ (V03)

Chế độ tương thích SQLite tự sửa kiểu khóa chính của audit_logs nếu phát hiện BIGINT AUTO_INCREMENT cũ trong SQLite: tạo bảng INTEGER PRIMARY KEY AUTOINCREMENT, sao chép toàn bộ cột và cấp ID theo rowid trong giao dịch. Nội dung, actor, JSON và thời gian giữ nguyên. Không áp dụng thao tác này cho MySQL. Sao lưu CSDL trước mọi lần nâng cấp. Chuyển đổi đã có kiểm thử dữ liệu cũ và chạy lại không lặp.

## Bổ sung V06.10 — Cấu trúc chương trình học

Phân hệ `src/modules/curriculum/` có một nguồn truy vấn chương trình trong
`curriculum.repository.js`, quản lý học phần/nhóm tự chọn/tiên quyết có kiểm soát
quyền và phiên bản trong `curriculum.service.js`, và tính tiến độ riêng trong
`curriculum-progress.service.js`. Các API nằm trong `curriculum.routes.js`.

Khi thay đổi cấu trúc đã có sinh viên đăng ký cần tạo phiên bản chương trình
mới; không sửa các dòng làm thay đổi ý nghĩa lịch sử. API tiến độ chỉ hỗ trợ
đối chiếu, không phê duyệt tốt nghiệp. Xem `../docs/BAO_CAO_V06_10.md`.
