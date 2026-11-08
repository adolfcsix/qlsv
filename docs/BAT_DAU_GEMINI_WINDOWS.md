# Bắt đầu với Gemini trên Windows / VS Code — V06.21

## 1. Mở đúng dự án

Cài Node.js từ 22.13.0 trở lên. Giải nén ZIP hoặc clone repository, mở thư mục **có `package.json`** trong VS Code. Chọn **Terminal > New Terminal**:

```powershell
node -v
npm -v
npm ci
```

Chạy `npm run dev` nếu chỉ muốn thử web trước. Mở [http://localhost:5173](http://localhost:5173); mặc định SQLite có dữ liệu demo, không cần MySQL. Dừng bằng Ctrl+C trước khi cấu hình AI.

## 2. Nhập key

Tạo Gemini API key của bạn tại [Google AI Studio](https://aistudio.google.com/apikey). Trong Terminal gốc dự án:

```powershell
npm run ai:setup
```

Dán key rồi Enter; ký tự không hiện là bình thường. Script lưu key vào `.env` cạnh `package.json`, giữ cấu hình database và đặt các biến AI về Gemini mặc định. Không cần sửa code, không nhập key trên frontend hoặc gửi key qua chatbot.

`AI_MODEL` mặc định trong mẫu là `gemini-2.5-flash`. Nếu tài khoản không hỗ trợ model này, sửa tên model được cấp và có tool calling trong `.env`. Để bật tìm kiếm web với Gemini, bảo đảm `AI_WEB_SEARCH=1`; model/quota phải hỗ trợ Google Search. Cấu hình khác xem [hướng dẫn tích hợp AI](HUONG_DAN_TICH_HOP_AI.md).

## 3. Thử kết nối thật

```powershell
npm run check:ai
```

Lệnh gửi hai yêu cầu thật tới mô hình: chọn công cụ lookup và diễn giải dữ liệu giả lập. **Đạt bước này chưa có nghĩa AI thao tác hoặc tìm kiếm web đã được kiểm tra.** Lỗi 401/403: kiểm tra key/quyền; 404: endpoint/model; 429: quota; timeout: mạng/model. Không đưa key vào ảnh chụp lỗi.

## 4. Mở chatbot và thử ba chức năng

```powershell
npm run dev
```

Mở web, đăng nhập `cb001` với mật khẩu demo **`Hocvu@2026`**. Các tài khoản demo khác: `quantri`, `gv001`, `20240001`.

1. **Tra cứu:** mở chatbot, dùng nút kiểm tra AI thật rồi hỏi “Khóa K24 có bao nhiêu lớp hành chính?”. Kiểm tra nhãn AI diễn giải và dữ liệu được phép xem.
2. **AI thao tác:** trên DB demo, nói “Thêm khóa K30, tên Khóa tuyển sinh 2030”, chọn mã chưa tồn tại. Trả lời trường còn thiếu, kiểm tra bản xem trước, thử Hủy. Khi muốn ghi thật, chuẩn bị lại rồi bấm Xác nhận và kiểm tra danh mục. Gõ “đồng ý” không tự ghi.
3. **Hỏi ngoài lề:** hỏi thông tin ngoài hệ thống cần nguồn. Chỉ coi đã có tìm kiếm web khi provider thực sự trả nguồn trong câu trả lời. Nếu không có nguồn, không suy diễn rằng tìm kiếm đã chạy thành công.

Sinh viên có thể nhờ AI gửi đăng ký lớp học phần đang mở; sau xác nhận vẫn chờ cán bộ duyệt. Mọi thao tác vẫn bị giới hạn bởi quyền, điều kiện đăng ký, sĩ số và lịch. Xem [36 tác vụ và giới hạn](TRO_LY_THAO_TAC_V06_21.md).

## 5. Kiểm tra local, dừng và chạy lại

Mở Terminal khác ở gốc dự án:

```powershell
npm run check:local
npm test
```

Hai lệnh này không thay thế kiểm tra provider thật. V06.21 đã thử giao thức provider bằng HTTP giả lập, chưa được xác nhận bằng key Gemini thật trong môi trường kiểm tra của dự án; ba bước ở mục 4 là phần bạn cần thử với key của mình.

Dừng web bằng Ctrl+C. Lần sau chỉ cần `npm run dev`; không phải nhập key hoặc `npm ci` lại nếu cấu hình và dependencies chưa đổi. Mỗi lần chỉnh `.env` phải khởi động lại server. Dữ liệu SQLite vẫn lưu trong `backend/data/`; xem [sao lưu và nâng cấp](../README.md#sao-lưu-và-nâng-cấp) trước khi thay bản code.
