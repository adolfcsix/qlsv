# Quản trị tài khoản — QLSV V06.15

Ngày 08/11/2026. Bổ sung trên nền đầy đủ V06.14. Giữ JavaScript ES Modules thuần, frontend/backend tách rõ, không thêm framework hay dependency mới.

## 1. Vào trang quản trị

Chạy `npm ci`, `npm run dev`. Mở http://localhost:5173, Ctrl+F5. Đăng nhập quantri / Hocvu@2026 (tài khoản dữ liệu giả), chọn Tài khoản.

Ba tab:

- Đang quản lý: tài khoản hoạt động/khóa, tìm theo tên/tên đăng nhập/email, lọc vai trò và trạng thái.
- Hồ sơ chưa cấp: sinh viên, giảng viên, cán bộ chưa liên kết tài khoản; có nút cấp từ dòng hồ sơ.
- Đã xóa: tài khoản có lịch sử xử lý đã bị chặn đăng nhập và giữ để truy vết. Có chi tiết/lý do và khôi phục.

## 2. Tạo/cấp tài khoản

Nhấn Tạo / cấp tài khoản, nhập tên đăng nhập, email, chọn vai trò, trạng thái, hồ sơ, mật khẩu tạm và căn cứ cấp.

| Vai trò | Nguồn hồ sơ |
|---|---|
| Sinh viên | Chọn hồ sơ sinh viên do cán bộ đào tạo lập. Quản trị không tự tạo học vụ qua biểu mẫu tài khoản. |
| Giảng viên | Chọn hồ sơ giảng viên chưa cấp hoặc tạo hồ sơ giảng viên mới: mã, tên, khoa/đơn vị, điện thoại tùy chọn. |
| Cán bộ đào tạo | Chọn hồ sơ cán bộ chưa cấp hoặc tạo hồ sơ nhân sự mới ngay trong biểu mẫu. |
| Quản trị | Hồ sơ nhân sự tương tự cán bộ, nhưng tài khoản nhận quyền quản trị. |

Không gắn một hồ sơ với hai tài khoản. Tên đăng nhập/email được kiểm tra trùng không phân biệt hoa thường; tên đăng nhập 3–100 ký tự chữ/số/dấu chấm/gạch dưới/gạch ngang. Mật khẩu tạm 10–128 ký tự, được hash scrypt, không ghi vào audit hay trả lại API. Bàn giao riêng cho người dùng.

Người được cấp phải đổi mật khẩu tạm khi đăng nhập; chưa đổi thì chưa vào các nghiệp vụ có quyền. Hồ sơ nhân sự và tài khoản được tạo trong cùng giao dịch, lỗi ở một phần sẽ hoàn tác toàn bộ.

## 3. Sửa tài khoản và phân vai trò

Nhấn Sửa / vai trò trên dòng tài khoản. Sửa tên đăng nhập, email, trạng thái, vai trò và hồ sơ liên kết; ghi lý do.

Khi chuyển loại vai trò (ví dụ sinh viên → cán bộ), chọn/tạo đúng hồ sơ đích. Hệ thống gỡ liên kết đăng nhập ở hồ sơ cũ, liên kết sang hồ sơ mới nhưng giữ nguyên hồ sơ cũ, điểm, đăng ký, lịch sử xử lý. Không dùng ID của hồ sơ thuộc người khác đã có tài khoản.

Mỗi tài khoản có một vai trò hiện hành. Đây là đổi vai trò, chưa phải một tài khoản đồng thời nhiều vai trò. Quyền thật do backend kiểm tra, không dựa vào lựa chọn menu của trình duyệt.

Phiên cũ bị thu hồi khi đổi username/email/vai trò/liên kết/trạng thái hoặc cấp mật khẩu tạm. Người dùng đăng nhập lại và vào đúng khu vực theo vai trò mới. Nếu quản trị sửa username/email của chính mình, giao diện đưa về đăng nhập với thông báo; dùng thông tin mới để vào lại.

Vai trò và trạng thái của chính quản trị đang dùng được khóa trên biểu mẫu; backend cũng không cho tự khóa, xóa hoặc hạ quyền. Mật khẩu của bản thân đổi ở Hồ sơ & bảo mật.

## 4. Khóa/mở khóa và đặt lại mật khẩu

Mở Chi tiết tài khoản để khóa/mở khóa hoặc đặt lại mật khẩu. Mỗi thao tác cần lý do; reset nhập mật khẩu tạm mới. Phiên đăng nhập cũ bị thu hồi, không chỉ đổi nhãn trên giao diện. Reset buộc người nhận đổi mật khẩu ở lần đăng nhập tiếp theo.

## 5. Xóa và khôi phục

Xóa yêu cầu lý do và không xóa hồ sơ sinh viên/giảng viên/cán bộ hoặc dữ liệu học tập.

- Tài khoản chưa có lịch sử thao tác: xóa user/security/session, bỏ liên kết tài khoản ở hồ sơ. Hồ sơ giữ nguyên và có thể cấp tài khoản lại.
- Tài khoản được tham chiếu bởi lịch sử nghiệp vụ/audit: giữ user để truy vết, chuyển locked, thu hồi phiên, thêm vào tab Đã xóa. Tên đăng nhập/email vẫn được giữ để khôi phục và tránh trùng danh tính.
- Tài khoản đã xóa khỏi sử dụng không sửa/mở khóa trực tiếp qua endpoint cũ hay endpoint mới. Phải khôi phục trước.
- Khôi phục trở về trạng thái khóa. Kiểm tra thông tin, đặt lại mật khẩu nếu cần rồi mở khóa. Không tự đăng nhập trở lại bằng phiên cũ.
- Không xóa/khóa/hạ quyền quản trị cuối cùng; hai quản trị thao tác đồng thời cũng không được làm hệ thống hết quản trị hoạt động.

Tài khoản đã xóa thật không có bản ghi trong tab Đã xóa. Muốn cấp lại, dùng hồ sơ chưa cấp. Hệ thống không xóa dây chuyền học bạ và nhật ký.

## 6. Thay đổi kỹ thuật

- Thêm một bảng account_archives bằng migration v06-15-accounts.sql, tự chạy khi khởi động và chạy lại được. Không sửa SQL 36 bảng lõi.
- accounts.service.js là nơi duy nhất ghi nghiệp vụ tài khoản. API mới và adapter changes cùng dùng writer, cùng bảo vệ vai trò/hồ sơ/quản trị cuối.
- API: POST /api/v1/admin/accounts; PATCH/DELETE /api/v1/admin/accounts/:id; POST /api/v1/admin/accounts/:id/restore.
- Thao tác ghi cần phiên quản trị, CSRF và revision. Bên trong giao dịch kiểm tra lại quyền/phiên quản trị để tránh dùng quyền cũ khi đang chờ một thao tác khác.
- Khi xóa, dò các khóa ngoại thật trỏ đến users để nhận biết lịch sử, không chỉ dựa vào hồ sơ đăng nhập. Hồ sơ học vụ được giữ, nhật ký chỉ lưu thông tin cần truy vết, không lưu mật khẩu/hash.
- Snapshot chỉ cấp danh sách hồ sơ phục vụ cấp tài khoản cho quản trị; các vai trò khác không nhận danh sách này.

## 7. Rà soát và kiểm thử

Kết quả toàn bộ: 162/162 tests, không skip; check:local 7/7; build và audit nguồn đạt. Audit kiểm tra 199 source files, không import mất đích, file trùng, nguồn mồ côi hay file cũ.

Các ca mới:

1. Chặn cán bộ/sinh viên/giảng viên quản lý tài khoản; không lộ danh sách hồ sơ cấp quyền.
2. Cấp tài khoản sinh viên từ hồ sơ và tạo tài khoản giảng viên/cán bộ với hồ sơ nhân sự mới, hoặc cấp từ hồ sơ có sẵn.
3. Chặn tên/email trùng, hồ sơ đã liên kết, đơn vị không tồn tại, vai trò không hợp lệ; rollback cả hồ sơ/tài khoản.
4. Mật khẩu được hash, không có plaintext/hash trong snapshot hoặc audit.
5. Sửa username/email thu hồi phiên cũ; đăng nhập bằng thông tin mới.
6. Sinh viên → cán bộ → giảng viên → sinh viên: liên kết và quyền đúng, hồ sơ/đăng ký cũ không mất.
7. Không lấy hồ sơ đang gắn người khác; revision cũ bị chặn; endpoint changes không bỏ qua bảo vệ.
8. Xóa thật tài khoản mới giữ hồ sơ chưa cấp; xóa cán bộ có lịch sử chuyển lưu trữ và không đăng nhập được.
9. Khôi phục vẫn khóa, reset bắt đổi, đổi mật khẩu thu hồi phiên.
10. Hai quản trị đồng thời khóa nhau: một thao tác thành công, vẫn còn một quản trị hoạt động.
11. Ca controller/forms/actions + HTTP thật và DOM giả lập: tạo cán bộ → đổi giảng viên → xóa → lưu trữ cán bộ cũ → khôi phục → sửa username/email chính mình và chuyển về đăng nhập.
12. Migration từ bản sao SQLite V06.14, giữ nguyên 6 tài khoản, 8 sinh viên, 11 đăng ký; chạy khởi tạo lại không mất dữ liệu.

Bộ kiểm thử cũ về ảnh, danh mục, sĩ số, xếp lịch, đăng ký chờ duyệt, điểm, học phí và AI giả lập tiếp tục đạt.

## 8. Phạm vi chưa kiểm chứng và cách cập nhật

Trình duyệt thực tế chưa được xác nhận: Playwright không tìm thấy executable Chromium trong môi trường. Ca DOM giả lập không phải kiểm thử trực quan pixel/scroll. Chưa chạy MySQL thật hoặc Gemini/Ollama thật trong đợt này. Không thay đổi kết luận kiểm chứng AI của các bản trước.

Giải nén vào thư mục mới để thử. Nếu giữ dữ liệu cũ, dừng server và sao lưu toàn bộ backend/data cùng .env trước khi chép sang bản mới. Migration tự chạy; không chép riêng DB đang được ghi. Không cần xóa DB cũ để nâng cấp.
