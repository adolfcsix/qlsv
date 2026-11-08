# Chạy QLSV V06.13.1 với Gemini thật trên Windows / VS Code

## 1. Chuẩn bị

- Node.js 22.13 hoặc mới hơn, VS Code, Internet và tài khoản Google để tạo Gemini API key.
- Giải nén thư mục `QLSV_V06_13_1`, mở đúng thư mục này bằng **File > Open Folder** trong VS Code.
- Mở **Terminal > New Terminal** rồi kiểm tra: `node -v`, `npm -v`.

## 2. Cài thư viện và tạo Gemini API key

```powershell
npm ci
```

Truy cập https://aistudio.google.com/apikey, đăng nhập, chọn **Create API key** nếu cần và sao chép khóa.

```powershell
npm run ai:setup
```

Dán API key trong Terminal khi được hỏi, nhấn Enter. Các ký tự sẽ **không xuất hiện**; khóa được lưu trong `.env`, không được gửi cho người khác hay commit lên GitHub.

## 3. Xác nhận kết nối AI thật

```powershell
npm run check:ai
```

Khi thành công, Terminal thông báo `ĐẠT: Mô hình AI trả lời qua HTTP và chọn được công cụ tra cứu.` Lệnh này gửi yêu cầu thật tới mô hình Gemini, dùng dữ liệu GIẢ LẬP để kiểm tra việc gọi công cụ và diễn giải; không phải kiểm tra dữ liệu trường thực tế.

Nếu lỗi 401/403: kiểm tra khóa và quyền truy cập; 404: model/endpoint; 429: quota; lỗi mạng/timeout: kiểm tra Internet. Model mặc định `gemini-2.5-flash`; có thể cập nhật `AI_MODEL` trong `.env` nếu model không còn được hỗ trợ trong tài khoản.

## 4. Khởi động web Local

```powershell
npm run dev
```

Mở http://localhost:5173. Mặc định dự án dùng SQLite và dữ liệu mẫu; không cần cài MySQL chỉ để kiểm tra AI. Dữ liệu demo có bốn tài khoản: `quantri`, `cb001`, `gv001`, `20240001`; mật khẩu demo mặc định `Hocvu@2026`. **Chỉ dùng cho môi trường thực hành Local.**

Đăng nhập `cb001`, mở chatbot, bấm **Kiểm tra AI thật** rồi đặt câu hỏi: `Khóa K24 có bao nhiêu lớp hành chính?`. Câu trả lời có nhãn **AI diễn giải** chỉ khi mô hình thật xử lý và backend truy vấn dữ liệu theo quyền. Nội dung được lấy từ dữ liệu mẫu và có thể thay đổi.

## 5. Kiểm tra và thoát

Mở một Terminal khác, chạy:

```powershell
npm run check:local
npm test
```

`check:local` kiểm tra Local, KHÔNG thay thế `check:ai`. Dừng web bằng Ctrl+C trong Terminal đang chạy `npm run dev`.

**Ghi chú:** `AI_REQUIRE_LIVE=1` đã cấu hình sẵn, do đó khi thiếu key hoặc AI bị gián đoạn, chatbot báo lỗi thay vì giả vờ đã gọi Gemini. Key được giữ server-side; không đưa dữ liệu cá nhân thật vào cơ sở dữ liệu demo hoặc gửi hồ sơ sinh viên thật lên API nếu chưa được phép.
