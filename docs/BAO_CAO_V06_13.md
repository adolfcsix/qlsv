# BÁO CÁO QLSV V06.13 — TÍCH HỢP MÔ HÌNH AI THẬT

Ngày hoàn thiện: 08/11/2026. Nền: QLSV V06.12.

## 1. Đã thay đổi

- Thêm API có xác thực `POST /api/v1/ai/verify`, chỉ trả đạt khi gọi mô hình qua HTTP thành công hai lần: chọn function `lookup` và diễn giải dữ liệu thử; hạn chế 5 lần/phút/tài khoản. Chưa có khóa thật nên không xác nhận hệ thống đã chạy với Gemini/OpenAI/Ollama trong môi trường dựng bản.
- Thêm `scripts/check-ai.mjs` và lệnh `npm run check:ai` để chạy phép kiểm tra kết nối thật không cần database, không ghi nội dung cá nhân. Không có key sẽ thất bại rõ ràng, thay vì báo đạt giả.
- Có chế độ `AI_REQUIRE_LIVE=1`: nếu thiếu model, mất mạng hoặc model không hỗ trợ tool calling, chatbot trả lỗi 503 rõ ràng; không giả làm AI bằng bộ tra cứu mẫu câu. Trong `.env.example` đặt mặc định =1. Chế độ dự phòng =0 vẫn giữ cho hoạt động offline nhưng nhãn là “Tra cứu dữ liệu”.
- Giao diện chatbot thêm nút **Kiểm tra AI thật**, có thông báo xác nhận model và tool calling hoặc lỗi, không hiển thị API key. Nhãn **AI diễn giải** chỉ xuất hiện nếu mô hình thực sự trả về phần giải thích.
- Khi mở lịch sử hội thoại, hệ thống truy vấn lại dữ liệu theo quyền hiện tại; chỉ dùng lại lời diễn giải AI nếu bảng nguồn không đổi. Nếu đã đổi số liệu, hiển thị lại dữ liệu mới và ghi rõ không dùng lời giải thích cũ.
- Điều chỉnh quyền chatbot: ADMIN không được tự đọc danh sách hồ sơ sinh viên; có thể tra cứu số tổng hợp trong phạm vi cho phép. Không mở API viết SQL tự do.
- Đã bổ sung tài liệu từng bước cấu hình Gemini / OpenAI / Ollama trong `docs/HUONG_DAN_TICH_HOP_AI.md`.

## 2. Bằng chứng kiểm thử

- `npm test`: **114/114 đạt**. Có bài kiểm thử provider giả lập chức năng OpenAI-compatible, gồm hai lần gọi model, kết nối API HTTP có cookie và CSRF, đọc SQL có phân quyền, chặn sinh viên dùng công cụ ngoài quyền.
- `npm run check:local`: **7/7 đạt** với dữ liệu SQLite trong RAM, đăng nhập bốn vai trò và quyền chatbot.
- `npm run audit:source`: **186 file JS/MJS**; 0 missing import, 0 file trùng nguyên nội dung, 0 module không dùng, 0 file lỗi thời. Còn `frontend/src/services/repository.js` dùng API tương thích `/state` và `/changes` bởi các màn hình chưa chuyển; đây chưa thể xóa an toàn.
- `npm run build`: đạt. Chưa dùng kiểm thử trình duyệt E2E hoặc máy chủ MySQL thật.
- `backend/database/qlsv-original.sql` giữ nguyên SHA-256: `836a625bfd4ed8ba058cb2749c9727a32919d80e43acd68fa8ccb58cfa221ddd`.

## 3. Điều gì chưa xác minh

- **Chưa có khóa AI thật hoặc mô hình Ollama đang chạy trong phiên này**, nên không thể tuyên bố Gemini/OpenAI/Ollama đã trả lời trên máy người dùng. Cần cấu hình `.env`, chạy `npm run check:ai` và tự thử vài câu hỏi qua giao diện. Bài test với provider mô phỏng chỉ kiểm chứng code/giao thức, không thay thế phép thử thực.
- Chưa kiểm thử MySQL thật, E2E trình duyệt/điện thoại, tải lâu hoặc chất lượng trả lời của từng model cụ thể. Không có bằng chứng “mọi câu hỏi đều trả lời đúng”.
- Các công cụ chatbot hiện chỉ cho phép các intent tra cứu đã khai báo, không hỗ trợ tác vụ ghi tùy ý hoặc câu hỏi toàn diện ngoài phạm vi học vụ.
- Với Gemini/OpenAI cloud, backend sẽ gửi một phần kết quả tra cứu đến API để mô hình diễn giải. **Chỉ sử dụng dữ liệu demo khi bảo vệ** hoặc phải được nhà trường chấp thuận trước khi dùng dữ liệu cá nhân thật.

## 4. Hướng dẫn bảo vệ 5 phút

1. Chạy `npm run check:ai` để chứng minh mô hình trả lời thật và biết chọn tool; nếu lệnh thất bại thì chưa thể nói AI chạy.
2. Chạy `npm run dev`, đăng nhập cán bộ `cb001` với dữ liệu demo, mở Học Vụ Chatbot rồi nhấn **Kiểm tra AI thật**.
3. Hỏi “Khóa K24 có bao nhiêu lớp?”, xem câu trả lời có nhãn AI diễn giải và nguồn `student_groups`, `curricula`.
4. Thử với tài khoản sinh viên tra bảng điểm của người khác: backend phải trả lỗi không có quyền.
5. Mở `backend/src/modules/ai/ai-provider.js`, `ai.service.js`, `ai-tools.js` để giải thích nơi gọi model, nơi truy vấn SQL và chặn quyền.

## 5. Không để code tồn đọng

Các thay đổi được đưa vào các file đúng nhiệm vụ trong cấu trúc V06 đã chốt. Không tạo bộ truy vấn SQL thứ hai, không tạo chatbot frontend thứ hai, không chép lại schema. File tương thích `/state`/`/changes` chỉ bỏ khi đã di chuyển các nơi sử dụng và có kiểm thử xác nhận.
