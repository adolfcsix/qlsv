# QLSV V06.13.1 — Báo cáo cấu hình AI Gemini

## Mục tiêu

Lấy V06.13 làm nền, mặc định sử dụng một mô hình AI thật (Gemini 2.5 Flash), dễ cấu hình trên Windows/VS Code, không đưa khóa API vào frontend, GitHub hoặc ZIP. Không thay cấu trúc dữ liệu, luồng SQL, phân quyền và nghiệp vụ của V06.13.

## Những phần đã sửa

- `backend/src/modules/ai/ai-provider.js`: khai báo **một nguồn mặc định** cho endpoint Gemini OpenAI-compatible và model `gemini-2.5-flash`; mọi lượt gọi tool và diễn giải dùng chung giá trị này; phân biệt lỗi 401/403, 404, 429 khi kiểm tra mô hình.
- `.env.example`: điền sẵn `AI_BASE_URL`, `AI_MODEL`, `AI_TIMEOUT_MS=30000`, `AI_REQUIRE_LIVE=1`, còn **`AI_API_KEY=` để trống** (không thể tự sinh API key thật).
- `scripts/configure-ai.mjs`: `npm run ai:setup` yêu cầu nhập khóa trong Terminal không hiển thị, tạo hoặc cập nhật `.env` và giữ nguyên thông số database. File `.env` được bỏ qua bởi `.gitignore`.
- `package.json`: thêm lệnh `ai:setup`; đồng bộ metadata `package-lock.json`.
- `frontend/src/features/chatbot/chat-panel.js`: hướng dẫn lệnh cấu hình khi chưa có key.
- `scripts/audit-source.mjs`: xác nhận lệnh CLI mới là một entrypoint hợp lệ, không nhầm thành file tồn đọng.
- `tests/gemini-default-config.test.mjs`: thêm hai phép kiểm tra cấu hình mặc định, tính an toàn và không nhân đôi biến.
- `README.md`, `docs/HUONG_DAN_TICH_HOP_AI.md`: hướng dẫn cấu hình một lần.

## Kết quả kiểm tra đã thực hiện

| Lệnh / kiểm tra | Kết quả |
| --- | --- |
| `npm test` | **116/116** đạt |
| `npm run check:local` | **7/7** đạt, SQLite trong RAM; không chạm MySQL thật |
| `npm run audit:source` | Không phát hiện import hỏng, file JS bỏ quên, file trùng nguyên nội dung |
| `npm run build` | Đạt |
| Kiểm tra `npm run ai:setup` trên terminal mô phỏng (khóa giả) | Tạo `.env`, giữ nguyên cấu hình DB, khóa không xuất hiện ở output |
| `npm run check:ai` với khóa Gemini **thật** | **Chưa xác nhận**; chưa có khóa và kết nối tới dịch vụ của người dùng |
| Thử thao tác trình duyệt và MySQL trên máy người dùng | Chưa xác nhận |

## Các bước dùng trên Windows

1. Tải và giải nén source; mở thư mục gốc dự án trong VS Code.
2. Chạy `npm ci` rồi `npm run ai:setup`; dán **API key cá nhân** lấy từ Google AI Studio (không gửi qua chat).
3. Chạy `npm run check:ai`. Phải nhận được thông báo mô hình đã trả lời và gọi được công cụ. Lệnh kiểm tra này **gửi yêu cầu thật** tới Gemini.
4. Chạy `npm run dev`, mở `http://localhost:5173`, đăng nhập và nhấn **Kiểm tra AI thật** trong cửa sổ chatbot.
5. Hỏi số lớp của khóa K24 và thử hỏi bảng điểm trái quyền. AI chỉ được dùng công cụ đọc dữ liệu mà backend cho phép.

## Giới hạn và an toàn

- Cấu hình **không tương đương** với việc đã sở hữu key hoặc mô hình đã phản hồi thật. Không có khóa API do người dùng cung cấp, chương trình không thể xác nhận Gemini hoạt động.
- Khi `AI_REQUIRE_LIVE=1`, chatbot báo lỗi nếu thiếu hoặc mất kết nối AI; không sử dụng bộ trả lời mẫu để giả làm AI.
- Dữ liệu cá nhân thật của sinh viên **không nên** gửi tới API đám mây nếu nhà trường chưa cho phép. Cơ sở dữ liệu demo là lựa chọn phù hợp khi bảo vệ đồ án.
- `.env` không được đóng gói; nếu làm lộ khóa thì thu hồi và tạo khóa mới.
- Không bổ sung bảng dữ liệu mới và không nhân đôi bộ tra cứu SQL.
