# HƯỚNG DẪN DEMO AI THẬT — QLSV V06.13.1

## 1. Phân biệt hai chế độ

- **AI thật**: frontend gọi backend, backend gửi lời hỏi đến mô hình qua API, mô hình chọn tool `lookup`, backend kiểm tra quyền người dùng và truy vấn SQL thực, sau đó mô hình diễn giải chính dữ liệu đã được kiểm tra. Dấu hiệu trong giao diện: **AI diễn giải**.
- **Tra cứu nội bộ**: nhận diện mẫu câu và chạy SQL bằng chương trình, **không phải mô hình ngôn ngữ**. Nếu muốn giáo viên kiểm tra AI thật, đặt `AI_REQUIRE_LIVE=1` để mất kết nối sẽ báo lỗi thay vì tự chuyển chế độ.
- **Dữ liệu mẫu**: SQLite seed phục vụ demo; có thể thay bằng MySQL. Dù database ở local, mô hình Gemini/OpenAI được gọi qua Internet, còn Ollama chạy ngay trên máy.

## 2. Chọn một mô hình

**Gemini đã được cấu hình sẵn trong `.env.example` và `ai-provider.js`.** Chạy `npm run ai:setup` để nhập khóa riêng trong Terminal (không hiện ký tự); không cần sửa code. Lệnh giữ nguyên cấu hình database có sẵn. Nếu dùng OpenAI hoặc Ollama thì chỉnh `.env` như ví dụ dưới đây. **Không đưa khóa API vào frontend hoặc GitHub.**

### Cách A — Gemini (cần Internet)

```dotenv
AI_API_KEY=DIEN_KHOA_GEMINI_CUA_BAN
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.5-flash
AI_TIMEOUT_MS=30000
AI_REQUIRE_LIVE=1
```

Mẫu này đã là mặc định của dự án; chỉ cần API key cá nhân. Nếu model không được cấp trong tài khoản, chọn một model Gemini có hỗ trợ function calling rồi cập nhật riêng `AI_MODEL` trong `.env`.

### Cách B — OpenAI (cần Internet)

```dotenv
AI_API_KEY=DIEN_KHOA_OPENAI_CUA_BAN
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
AI_TIMEOUT_MS=30000
AI_REQUIRE_LIVE=1
```

### Cách C — Ollama (mô hình chạy Local)

Cài Ollama trên Windows, tải và chạy một model **có hỗ trợ tool calling**, ví dụ:

```powershell
ollama pull qwen3:4b
ollama serve
```

Nếu Ollama đã chạy nền, không cần `ollama serve` lần nữa. Máy cần đủ RAM cho model và tải model lần đầu cần Internet.

```dotenv
AI_API_KEY=ollama
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=qwen3:4b
AI_TIMEOUT_MS=30000
AI_REQUIRE_LIVE=1
```

Một số model không chọn được tool; `npm run check:ai` sẽ báo chưa đạt. Thay model nếu cần.

## 3. Kiểm chứng trước mặt giáo viên

Mở Terminal tại thư mục `QLSV_V06_13_1`:

```powershell
npm ci
npm run ai:setup
npm run check:ai
npm run check:local
npm run dev
```

`check:ai` **gửi hai lời gọi thật đến mô hình**: (1) bắt mô hình chọn công cụ `lookup` cho câu hỏi về khóa; (2) đưa dữ liệu giả lập để kiểm tra mô hình diễn giải. Nếu không gọi được mô hình hoặc model không biết tool calling, lệnh trả về lỗi và exit code 1; **không chấm đạt bằng fake/mock**.

Truy cập `http://localhost:5173`, đăng nhập bằng tài khoản cán bộ demo rồi mở **Học Vụ Chatbot**. Nhấn **Kiểm tra AI thật**, chờ thông báo *Đã kết nối và gọi công cụ*. Tiếp theo hỏi:

- “Khóa K24 có bao nhiêu lớp hành chính?”
- “Lớp CNTT K24A có bao nhiêu sinh viên?”
- “Tìm sinh viên tên Nguyễn Minh Anh.”
- “Bảng điểm sinh viên 20240001.” (chỉ trả khi tài khoản có quyền)

Kết quả hội thoại thật phải có nhãn **AI diễn giải** kèm bảng và nguồn SQL. Trường hợp bị chặn quyền phải báo từ backend dù AI chọn đúng ý định.

`check:local` chạy riêng với SQLite mẫu, **không** khẳng định API mô hình đã kết nối; `npm test` dùng server giả lập để tự động kiểm tra giao thức, không dùng nó làm bằng chứng kết nối tới Gemini/OpenAI/Ollama thật.

## 4. Luồng hoạt động dễ giải thích khi bảo vệ

```text
Người dùng gửi câu hỏi
  ↓ frontend/src/features/chatbot/chat-widget.js
POST /api/v1/ai/messages
  ↓ backend/src/modules/ai/ai.routes.js
backend/src/modules/ai/ai.service.js
  ↓ ai-provider.js gọi mô hình qua API, nhận tool arguments
  ↓ ai-tools.js kiểm tra intent, vai trò, ID sinh viên
  ↓ SQL (MySQL hoặc SQLite) truy vấn dữ liệu thật
  ↓ ai-provider.js gửi dữ liệu đã kiểm tra để mô hình diễn giải
  ↓ JSON kết quả, nguồn SQL, nhãn AI diễn giải
Giao diện chatbot hiển thị
```

**Giới hạn:** phiên bản này hỗ trợ các nhóm intent đã được khai báo, chưa phải AI tự động thực hiện mọi thao tác của hệ thống. AI chỉ được đọc dữ liệu theo quyền, không tự ý thêm/sửa/xóa, không được viết hoặc chạy SQL tùy ý. Không gửi dữ liệu sinh viên thật đến API đám mây nếu chưa được nhà trường cho phép; dùng cơ sở dữ liệu demo giả lập khi bảo vệ.

## 5. File cần mở khi giáo viên hỏi

| Giáo viên hỏi | File |
|---|---|
| API nhận câu hỏi ở đâu? | `backend/src/modules/ai/ai.routes.js` |
| Mô hình AI được gọi ở đâu? | `backend/src/modules/ai/ai-provider.js` |
| Xử lý hội thoại và lưu lịch sử? | `backend/src/modules/ai/ai.service.js` |
| AI được truy vấn những dữ liệu nào? | `backend/src/modules/ai/ai-tools.js` |
| Giao diện và nút kiểm tra? | `frontend/src/features/chatbot/chat-widget.js`, `chat-panel.js` |
| Kiểm tra kết nối model thật? | `scripts/check-ai.mjs` |
