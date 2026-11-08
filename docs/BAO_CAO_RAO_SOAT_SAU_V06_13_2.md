# Báo cáo rà soát sâu QLSV V06.13.2

Ngày kiểm tra: 08/11/2026. Phạm vi: bản QLSV V06.13.1 vừa sửa lỗi trang trắng. Mục tiêu là chạy local cho đồ án, giữ cấu trúc frontend/backend và schema 36 bảng lõi.

## Kết luận

Có lỗi thực tế ngoài lỗi trang trắng; đã sửa các lỗi được xác nhận dưới đây. 132/132 kiểm thử tự động đạt, 7/7 kiểm tra local đạt, build và kiểm toán nguồn đạt. Đây không phải chứng nhận mọi tính năng không còn lỗi. Giao diện DOM giả lập + HTTP thật không thay thế E2E bằng trình duyệt.

## Các điểm đã sửa

| Nhóm | Trước khi sửa | Sau khi sửa |
|---|---|---|
| Tải module | `/shared/lookup-intents.js` nằm ngoài thư mục được phục vụ, khiến tải giao diện dừng | Giữ bản sửa public module qua HTTP, bản build kèm module; kiểm thử duyệt cả import tĩnh và động |
| Khởi động giao diện | Lỗi import hoặc render ngoài vùng try/catch có thể để trang trống | Có trạng thái đang tải, bắt lỗi khởi động và nút tải lại; hiển thị thông báo bằng textContent |
| Đề nghị/duyệt sửa điểm | `context()` tạo đối tượng mới và làm mất `remoteGradebook`/`remoteGradeChanges`, nên bấm nút có thể báo không tìm thấy | Hành động nhận lại dữ liệu của màn hình đang hiển thị, chỉ khi đúng người dùng và đường dẫn |
| Mốc so sánh điểm nháp | Khi mất context, mốc so sánh rơi về dữ liệu vừa tải, có nguy cơ ghi đè sửa đổi ở phiên khác | Lưu điểm dựa trên sổ điểm đã hiển thị; không thay mốc bằng lần GET mới; API trả 409 khi điểm thay đổi |
| Phản hồi bất đồng bộ | Yêu cầu nền hoàn tất có thể render lại và làm mất ô điểm đang nhập | Không render lại vì kết quả nền khi đang có điểm chưa lưu |
| Đồng bộ sau lưu | Một số thao tác chương trình/học vụ chỉ xóa cache danh sách mà chưa cập nhật snapshot/revision | Đợi cập nhật snapshot trước khi render và báo thành công; các callback đợi hoàn tất; danh sách quay về trang đầu sau thay đổi |
| Chọn lần thi | Đổi lựa chọn lần thi vẫn giữ điểm/trạng thái của lần đầu | Nạp đúng điểm, trạng thái và thang điểm của lần được chọn; xóa căn cứ cũ; vắng/chưa thi gửi điểm null |
| Ghi điểm thi đồng thời | Biểu mẫu không gửi mốc ban đầu nên lần lưu sau có thể đè điểm | Giao diện gửi expected, API đối chiếu trong transaction và trả STALE_EXAM_SCORE khi dữ liệu đã đổi |
| Lần học đã hủy/rút | API nhập điểm thi và API công bố một lần học thiếu kiểm tra trạng thái này | Chặn cả hai thao tác trước khi ghi dữ liệu |
| JSON sai cấu trúc | Login với null và changes có phần tử null tái hiện lỗi 500; dòng điểm hỏng cũng có thể phát sinh lỗi tương tự | Từ chối JSON không phải object bằng 400 và patch/dòng điểm hỏng bằng lỗi kiểm tra dữ liệu |
| Tiếng Việt trong HTTP | Cộng từng Buffer vào chuỗi có thể làm hỏng ký tự UTF-8 bị chia giữa gói | Ghép byte đầy đủ rồi giải mã UTF-8 một lần |
| Ngày tháng | JavaScript tự đổi ngày 30/2 hoặc 31/4 sang tháng sau, nhưng API vẫn nhận chuỗi ngày cũ | So sánh ngày thực sau khi parse; giữ đúng năm nhuận |
| Giờ, thứ, năm và ID | Regex giờ nhận 99:99; thứ/năm có thể là thập phân; ID quá lớn có thể bị làm tròn | Giờ 00:00–23:59, thứ/năm nguyên, ID là số nguyên an toàn |
| Mở lớp | Kiểm tra kỳ đăng ký dùng giờ UTC trong khi đăng ký học dùng giờ Việt Nam; biểu mẫu thiếu Chủ nhật | Dùng cùng mốc Asia/Ho_Chi_Minh; thêm Chủ nhật vào lựa chọn |
| Hết phiên/đăng xuất | Cache riêng tư chưa được xóa ở một số nhánh 401; logout khi phiên đã hết có thể dừng trước cleanup | Xóa user/CSRF/snapshot khi hết phiên và hoàn tất cleanup khi logout nhận 401 |

## Kiểm chứng

- `npm test`: 132/132, không skip. Bao gồm kiểm thử phân quyền 4 vai trò, CSRF, đổi mật khẩu, API dữ liệu học vụ, đăng ký tranh chỗ, tài chính, chương trình, tổng kết, cảnh báo, xét hồ sơ tốt nghiệp và AI provider giả lập.
- `npm run check:local`: 7/7, SQLite trong RAM, đăng nhập 4 vai trò, truy vấn theo quyền, frontend/API HTTP.
- `npm run audit:source`: không import mất đích, file trùng, nguồn mồ côi, file cũ, stylesheet mất đích hoặc không dùng.
- `npm run build`: tạo đầu ra tĩnh; module shared có trong build.
- Ca bổ sung dùng frontend controller/actions với API thật: hiển thị sổ điểm, phiên khác sửa điểm, phiên đang mở lưu điểm; xác nhận 409 và CSDL giữ điểm của phiên đã lưu trước. DOM trong ca này là giả lập.
- Ca bổ sung kiểm tra JSON null/array, patch null, dòng điểm null, UTF-8 chia gói, ngày không tồn tại, giờ không hợp lệ, năm thập phân, ID quá lớn, selector lần thi, điểm thi bị sửa đồng thời và chặn lần học đã rút.
- Giữ nguyên nội dung file SQL 36 bảng lõi; không đóng gói `.env`, node_modules, dist hoặc CSDL được tạo khi kiểm thử.

## Những phần chưa xác nhận và giới hạn còn lại

1. Trình duyệt thực tế: môi trường thiếu Chromium. Lần thử cài trình duyệt nhận gói tải không hợp lệ, nên chưa xác nhận toàn bộ nút, focus, scroll và responsive bằng Chrome/Edge/iPhone. Không dùng kết quả DOM giả lập để tuyên bố E2E đạt.
2. MySQL: kiểm thử lần này dùng SQLite. Chưa có máy chủ MySQL thật để xác nhận migration, kiểu dữ liệu và mọi truy vấn trên MySQL.
3. Gemini/Ollama thật: không có API key/mô hình đang chạy. Có kiểm thử provider giả lập và kiểm soát quyền truy vấn, chưa xác nhận kết nối nhà cung cấp thực. Chạy `npm run ai:setup`, rồi `npm run check:ai` trên máy người dùng.
4. Một số trang vẫn dùng snapshot `/state` và tương thích `/changes`; snapshot đọc nhiều bảng rồi lọc theo quyền. Đủ để kiểm thử local, chưa đo tải dữ liệu trường lớn hoặc nhiều người dùng.
5. Một số chức năng có giới hạn nghiệp vụ đã ghi trong README: chưa có quản trị toàn bộ quy chế, nhập danh sách/điều kiện dự thi đầy đủ trên giao diện, email khôi phục mật khẩu thật và tự động công nhận tốt nghiệp. Không bổ sung giả các chức năng này trong đợt sửa lỗi.
6. Chưa có quy chế trường chính thức để xác nhận mọi công thức học vụ. DEMO-01 chỉ minh họa; giữ cơ chế chặn công bố chính thức và những thay đổi ảnh hưởng tổng kết đã duyệt.

## Cách chạy và kiểm tra trên Windows

1. Giải nén vào thư mục mới, mở thư mục chứa package.json trong VS Code.
2. `npm ci`, sau đó `npm run dev` (Node.js >=22.13).
3. Mở http://localhost:5173, Ctrl+F5. Giữ Terminal đang chạy; không dùng Live Server cho bản full-stack.
4. Tài khoản mẫu: quantri, cb001, gv001, 20240001; mật khẩu Hocvu@2026. Đây là tài khoản dữ liệu giả.
5. Kiểm tra lần lượt: đăng nhập từng vai trò; mở menu và đổi trang; mở chatbot; cán bộ xem hồ sơ/lớp/khóa, sổ điểm và học vụ; thử lưu hai thao tác liên tiếp; đăng xuất/đăng nhập lại; xem ở cửa sổ nhỏ.
6. Nếu đang có dữ liệu riêng, giữ bản cũ và sao lưu trước; không chép đè `.env` hoặc CSDL vào bản mới trong lần thử đầu. Không cần xóa dữ liệu cũ để chạy bản này.
