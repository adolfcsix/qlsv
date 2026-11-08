# Hướng dẫn cán bộ — QLSV V06.14

## 1. Chạy và nhận biết hai loại lớp

Mở thư mục có package.json bằng VS Code. Node.js >=22.13. Chạy `npm ci`, `npm run dev`, mở http://localhost:5173 và Ctrl+F5. Đăng nhập cb001 / Hocvu@2026 để vào cán bộ.

- **Lớp hành chính**: hồ sơ sinh viên thuộc một lớp gắn chương trình của một ngành và một khóa, có cố vấn và sĩ số tối đa.
- **Lớp học phần / lớp học vụ**: một môn trong một học kỳ, có sĩ số riêng, danh sách sinh viên, nhiều buổi và nhiều giảng viên. Không dùng lớp này thay lớp hành chính của sinh viên.
- Khoa và ngành dùng chung giữa các khóa. Chương trình gắn ngành + khóa. Khi tạo lớp hành chính cần có chương trình trước.

## 2. Thêm/sửa/xóa khóa, khoa, ngành và lớp

Vào **Khóa · Khoa · Ngành · Lớp** ở sidebar, hoặc các lối vào nhanh trên tổng quan và trang xếp lịch. Chọn tab tương ứng. Nút thêm nằm ở đầu trang; nút **Sửa / Xóa** nằm trong mỗi dòng.

Thứ tự khi tạo hệ thống mới: khóa → khoa → ngành → chương trình → lớp hành chính. Khi tạo/sửa lớp, chọn cố vấn và sĩ số tối đa. Mặc định 50 với lớp chưa cấu hình; được chỉnh 1–1000. Không được hạ dưới số sinh viên còn thuộc diện quản lý đang học/bảo lưu/đình chỉ. Sinh viên đã thôi học/tốt nghiệp không chiếm chỗ trong giới hạn này.

Không xóa danh mục đang có quan hệ dữ liệu. Gỡ/chuyển dữ liệu liên quan theo đúng nghiệp vụ trước; không xóa dây chuyền cả hồ sơ và kết quả học tập.

## 3. Hồ sơ sinh viên và ảnh

Vào **Sinh viên → Thêm sinh viên**. Chọn khóa, khoa, ngành, chương trình và lớp; điền thông tin bắt buộc. Có thể bỏ trống ảnh.

Ảnh chấp nhận JPEG/PNG/WebP tối đa 5 MB đầu vào. Giao diện thu nhỏ tối đa 480×600 và nén trước khi gửi; backend giới hạn ảnh đã xử lý 80 KB, kiểm tra định dạng. Ảnh được lưu cùng giao dịch hồ sơ. Nếu lớp đầy hoặc dữ liệu không hợp lệ, không tạo dở hồ sơ/ảnh.

Cán bộ dùng **Chỉnh thông tin** để thay hoặc gỡ ảnh. Sinh viên chỉ xem ảnh trong hồ sơ, không có nút đổi ảnh và không được ghi ảnh qua API. Truy cập ảnh yêu cầu đăng nhập và đúng phạm vi hồ sơ.

## 4. Mở lớp học phần và đặt sĩ số

Vào **Xếp lịch & duyệt đăng ký → Mở lớp học phần**. Chọn môn, học kỳ, giảng viên phụ trách (có thể để trống), sĩ số tối đa và trạng thái. Sau khi tạo, hệ thống chuyển đến lớp đó.

Dùng **Sửa lớp / sĩ số** để đổi mã, giảng viên phụ trách, sĩ số hoặc trạng thái. Không đổi môn/học kỳ của lớp đã tạo để tránh làm sai lần học và điểm. Khi cần môn/học kỳ khác, tạo lớp mới.

Sĩ số lớp học phần từ 1–500, không thấp hơn danh sách hiện có; khi xếp buổi, phòng phải đủ sức chứa theo sĩ số tối đa. Phòng demo có 35–45 chỗ, nên đặt sĩ số tương ứng hoặc bổ sung phòng phù hợp trong dữ liệu của dự án.

**Xóa / hủy lớp** yêu cầu lý do. Lớp chưa phát sinh dữ liệu được xóa. Lớp có đăng ký/dự thi được hủy và giữ lịch sử, gỡ khỏi lịch hiện hành. Lớp đã có kết quả công bố được bảo vệ.

## 5. Thêm/sửa/xóa buổi và giảng viên

Chọn lớp học phần ở bộ lọc, nhấn **Thêm buổi học**. Chọn thứ, phòng, giờ bắt đầu/kết thúc, khoảng ngày hiệu lực trong học kỳ. Chọn một hoặc nhiều giảng viên bằng checkbox; bỏ chọn để gỡ phân công, có thể để chưa phân công.

Mỗi dòng buổi học có **Sửa / Xóa**. Khi xóa cần lý do. Lịch cá nhân cập nhật theo các buổi còn hiệu lực. Các buổi mới dùng phân công rõ ràng, không tự lấy lại giảng viên phụ trách khi bạn đã bỏ chọn hết. Các buổi từ bản cũ chưa có cấu hình riêng vẫn kế thừa giảng viên phụ trách.

Máy chủ chặn buổi trùng phòng, giảng viên, sinh viên hoặc nhóm lớp đang xếp; kiểm tra ngày/giờ thực và sức chứa. Nếu trùng, toàn bộ thay đổi bị hoàn tác. Mỗi buổi lặp theo thứ trong khoảng hiệu lực; khoảng ngày phải thực sự có thứ đã chọn. Đây là quản lý buổi học lặp, chưa có lịch nghỉ/học bù riêng.

## 6. Gán khóa/khoa/ngành/lớp cho toàn lớp hoặc một buổi

**Đối tượng chung của lớp học phần:** nhấn **Gán / gỡ đối tượng**. Chọn gán hoặc gỡ, rồi phạm vi lớp hành chính/toàn khóa/toàn khoa/toàn ngành. Hệ thống mở rộng phạm vi thành các lớp hành chính thực tế.

Checkbox **Đồng bộ sinh viên**:

- Khi gán: thêm các sinh viên đang học trong phạm vi vào lớp học phần, có kiểm tra chương trình, tiên quyết, tín chỉ, trùng lịch và sĩ số.
- Khi gỡ đối tượng chung: nếu bật đồng bộ sẽ gỡ sinh viên khỏi lớp học phần, giữ lịch sử đăng ký. Tắt đồng bộ để chỉ gỡ đối tượng; sinh viên đang có trong lớp vẫn được giữ như học ghép.
- Khi một người không đủ điều kiện hoặc hết chỗ, cả giao dịch bị hoàn tác và có thông báo mã sinh viên gây lỗi. Không tự bỏ qua điều kiện để nhét một khóa/khoa đông người vào một lớp nhỏ.

**Đối tượng riêng từng buổi:** trong cột **Đối tượng buổi**, nhấn **Gán / gỡ lớp**, vẫn chọn theo lớp/khóa/khoa/ngành. Lần gán đầu chuyển buổi sang danh sách riêng gồm các lớp được chọn. Có thể gán thêm hoặc gỡ từng phạm vi. Lần gỡ đầu từ chế độ chung lấy danh sách đối tượng chung rồi loại phần được chọn. Gỡ ở cấp buổi chỉ gỡ lịch buổi đó, không xóa danh sách học phần hay các buổi khác.

Nhấn **Dùng danh sách chung** để bỏ tùy chỉnh của buổi. Sinh viên học ghép ngoài đối tượng chung vẫn tham dự các buổi của lớp đã được duyệt/phân trực tiếp; có nhãn nhận biết.

Bộ lọc khóa/khoa/ngành/lớp ở đầu trang tìm các lớp học phần đã gán đối tượng chung. Bỏ bộ lọc để thấy lớp mới chưa gán.

## 7. Thêm/gỡ sinh viên đích danh

Trong **Danh sách sinh viên**, nhấn **Thêm sinh viên đích danh**, chọn mã/họ tên và ghi căn cứ phân lớp. Người thuộc lớp hành chính khác nhóm mục tiêu có nhãn **Học ghép / khác lớp** trên danh sách và lịch học. Không thay lớp hành chính trong hồ sơ khi thêm vào lớp học phần.

Cán bộ phân trực tiếp có thể thao tác ngoài cửa sổ đăng ký của sinh viên khi lớp còn mở/đang giảng dạy. Vẫn giữ kiểm tra chương trình, tiên quyết, tín chỉ, trùng lịch và sĩ số. Không tự đăng ký học phần ngoài chương trình.

**Gỡ khỏi lớp** cần lý do; bản ghi chuyển sang hủy, lịch học không còn buổi của lớp đó, dữ liệu lịch sử được giữ. Không gỡ khi đã có kết quả công bố.

## 8. Sinh viên gửi đăng ký, cán bộ duyệt

Sinh viên đăng nhập 20240001 / Hocvu@2026 → **Đăng ký học phần**, chọn lớp rồi **Gửi đăng ký chờ duyệt**.

- Yêu cầu mới có trạng thái chờ duyệt; chưa tạo enrollment, chưa chiếm chỗ và chưa xuất hiện lịch.
- Sinh viên xem kết quả/lý do và rút yêu cầu đang chờ. Không gửi hộ người khác hoặc tự duyệt.
- Cán bộ mở **Xếp lịch & duyệt đăng ký**, xem phần đăng ký phía dưới, có thể lọc chờ duyệt/đã duyệt/từ chối/đã rút và phân trang. Nút **Mở lớp** chuyển đến đúng lớp xin học.
- Nhấn **Duyệt** hoặc **Từ chối**. Từ chối bắt buộc lý do. Duyệt kiểm tra lại điều kiện tại thời điểm thực hiện; nếu hết chỗ/trùng lịch thì yêu cầu giữ chờ, không tạo bản ghi học dở.
- Sau duyệt, sinh viên có trong danh sách và lịch theo đối tượng từng buổi; nguồn ghi rõ đăng ký đã duyệt. Duyệt lại cùng yêu cầu bị chặn.

## 9. Cập nhật từ V06.13.2

Thử bản mới trong thư mục giải nén riêng trước. Nếu cần giữ dữ liệu cũ: dừng Terminal bản cũ bằng Ctrl+C, sao lưu toàn bộ thư mục `backend/data` và `.env`. Sau đó chép dữ liệu/cấu hình cần giữ sang bản mới khi cả hai server đều đã dừng. Không chép riêng file DB đang được ghi; giữ cả thư mục dữ liệu để không mất WAL.

Migration tự tạo các bảng bổ trợ khi khởi động. File SQL 36 bảng lõi giữ nguyên. Các đăng ký đã tồn tại trong bản cũ giữ nguyên là danh sách đã có; chỉ đăng ký mới của sinh viên đi qua chờ duyệt.

## 10. Kiểm tra

`npm run check:local`, `npm test`, `npm run audit:source`, `npm run build`.

Kiểm thử tự động không thay thế thực hành trực quan trên máy: mở các tab danh mục, thêm hồ sơ có/không ảnh, thay ảnh, chỉnh sĩ số, tạo một lớp và nhiều buổi, đổi giảng viên, gán/gỡ đối tượng từng buổi, đăng nhập sinh viên gửi yêu cầu, duyệt lại ở cán bộ rồi kiểm tra lịch. Thử thu nhỏ cửa sổ để kiểm tra bảng chỉ cuộn trong khối, không làm tràn toàn trang.
