# Tích hợp AI — Lac Hong University V06.21

Tài liệu này mô tả code hiện tại, cách bật mô hình và cách kiểm tra từng luồng. Xem [README](../README.md) để cài dự án, database, tài khoản và sao lưu; xem [hướng dẫn Windows](BAT_DAU_GEMINI_WINDOWS.md) nếu muốn làm từng bước.

## 1. AI đã tích hợp đến đâu?

| Luồng | Hoạt động | Điều kiện |
| --- | --- | --- |
| Tra cứu nội bộ | Mô hình chọn công cụ lookup, backend kiểm tra quyền và truy vấn DB, mô hình diễn giải kết quả | Provider hỗ trợ tool calling |
| Trợ lý thao tác | Trích trường thông tin, hỏi thiếu/không rõ, chuẩn bị bản xem trước, thực hiện sau nút xác nhận | Provider hỗ trợ tool `assist`; chỉ tác vụ trong catalog |
| Hỏi đáp bên ngoài | Trả lời kiến thức; Gemini có thể gọi Google Search và trả nguồn | Model/quota hỗ trợ; bật `AI_WEB_SEARCH` cho Gemini |
| Tra cứu/biểu mẫu cục bộ | Nhận diện ý định và thu thập trường theo mẫu, không gọi mô hình | Có thể dùng khi chưa có key; không phải bằng chứng AI thật |

Hiện có **36 tên tác vụ** theo vai trò. Sinh viên gửi/rút/hủy đăng ký; cán bộ quản lý khóa/khoa/ngành/chương trình/lớp, thêm sinh viên, lớp học phần, lịch, đối tượng học, phân sinh viên, duyệt đăng ký và điểm nháp; giảng viên sửa điểm nháp theo phân công; quản trị có một số danh mục/hồ sơ. Chi tiết và giới hạn nằm trong [tài liệu AI thao tác](TRO_LY_THAO_TAC_V06_21.md). Chưa phủ toàn bộ chức năng giao diện, chưa tự tối ưu lịch toàn trường hay ghi liên tiếp nhiều tác vụ phụ thuộc nhau.

Không cần viết thêm code để bật các chức năng đã có. Cần cấu hình backend, chạy kiểm tra kết nối rồi thử tác vụ bằng tài khoản đúng quyền.

## 2. Gemini: cấu hình mặc định

Tạo key của bạn tại [Google AI Studio](https://aistudio.google.com/apikey), mở Terminal tương tác ở gốc dự án:

```powershell
npm ci
npm run ai:setup
npm run check:ai
npm run dev
```

Dán key khi được hỏi, Enter; ký tự bị ẩn. `ai:setup` đọc `.env` hiện tại hoặc `.env.example`, giữ cấu hình khác và cập nhật key cùng các biến Gemini. Nếu server đang chạy thì dừng và khởi động lại để nạp biến mới.

```dotenv
AI_API_KEY=THAY_KEY_CUA_BAN
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.5-flash
AI_TIMEOUT_MS=30000
AI_REQUIRE_LIVE=1
AI_WEB_SEARCH=1
```

Đây là mẫu đang được lưu trong dự án, không phải cam kết về model/quota hiện tại của tài khoản Google. Nếu model không được cấp, đổi `AI_MODEL` sang model tài khoản được phép dùng và có hỗ trợ function calling; cần thêm Google Search nếu muốn tra cứu web. Timeout được chấp nhận từ 1000 đến 30000 ms.

`.env` đặt cạnh `package.json`, không nằm trong frontend. Không đưa key vào source, GitHub hay câu hỏi chatbot. Các truy vấn tra cứu có thể gửi dữ liệu đã được kiểm tra quyền đến provider để diễn giải; dùng dữ liệu demo khi kiểm chứng tích hợp.

`AI_REQUIRE_LIVE=1` yêu cầu mô hình thật đối với luồng tra cứu bằng mô hình. Nó không tắt các biểu mẫu/tra cứu cục bộ và không có nghĩa mọi câu trả lời chatbot đều đã qua Gemini. Lỗi provider của tác vụ/câu hỏi bên ngoài phải được đọc theo thông báo thực tế, không coi biểu mẫu cục bộ là gọi AI thành công.

## 3. Provider tương thích khác hoặc Ollama

Sửa `.env` thủ công, không chạy lại `ai:setup` nếu muốn giữ provider khác. Endpoint remote phải dùng HTTPS; HTTP chỉ được chấp nhận trên localhost. Base URL không chứa tài khoản, query hoặc fragment.

Ví dụ provider tương thích OpenAI:

```dotenv
AI_API_KEY=THAY_KEY_PROVIDER
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=THAY_MODEL_DUOC_CAP_QUYEN
AI_TIMEOUT_MS=30000
AI_REQUIRE_LIVE=1
AI_WEB_SEARCH=0
```

Ví dụ Ollama đã cài, đang chạy trên máy và đã tải model có tool calling:

```dotenv
AI_API_KEY=ollama
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=THAY_TEN_MODEL_DA_CAI
AI_TIMEOUT_MS=30000
AI_REQUIRE_LIVE=1
AI_WEB_SEARCH=0
```

Thay tên model mẫu bằng model thực tế. Model cần đáp ứng giao thức tool calling của cả `lookup` và `assist`; đạt lookup không bảo đảm tác vụ cũng đạt. Khả năng tương thích từng provider/model cần kiểm chứng trên máy sử dụng. Nhà cung cấp khác Gemini không mặc nhiên có tìm kiếm web thời gian thực trong code hiện tại.

## 4. Kiểm chứng đủ các luồng

### A. Kết nối và tra cứu

`npm run check:ai` gửi **hai HTTP request thật** đến provider: bắt chọn công cụ lookup rồi diễn giải dữ liệu giả lập. Lệnh lỗi nếu không đạt. Nó không lấy database trường thật và không kiểm tra tool `assist`, ghi dữ liệu hoặc Google Search.

Sau đó chạy web, đăng nhập cán bộ `cb001` bằng mật khẩu demo trong README, mở chatbot và dùng nút kiểm tra AI thật. Thử “Khóa K24 có bao nhiêu lớp hành chính?”, “Bảng điểm sinh viên 20240001”. Kết quả chỉ được nằm trong quyền hiện tại; nhãn **AI diễn giải** cho biết luồng thực sự dùng mô hình. Đổi sang sinh viên để kiểm tra dữ liệu người khác không được truy cập vượt quyền.

### B. Hỏi thiếu và xác nhận thao tác

Thử trên database demo vì bấm xác nhận sẽ ghi dữ liệu thật vào DB đó:

1. Cán bộ nói “Thêm khóa K30, tên Khóa tuyển sinh 2030”, chọn mã chưa tồn tại.
2. Trả lời các trường còn thiếu; nếu tên/mã nhập mơ hồ, cung cấp mã chính xác.
3. Kiểm tra bản xem trước. Chưa xác nhận thì danh mục chưa có bản ghi mới.
4. Bấm Hủy: không tạo. Chuẩn bị lại, kiểm tra rồi bấm Xác nhận: tạo bằng nghiệp vụ hiện có. Kiểm tra danh mục sau thao tác.
5. Thử đăng ký bằng sinh viên với mã lớp đang mở, còn hạn và đủ điều kiện: sau xác nhận vẫn chờ cán bộ duyệt.

Gõ “đồng ý” không thực thi. Đề xuất gắn với phiên/tài khoản/quyền, hết hạn sau 10 phút, dữ liệu thay đổi thì phải chuẩn bị lại. Xác nhận lặp cùng đề xuất không ghi lần hai. Không thể bỏ qua sĩ số, lịch, phân công hoặc quyền bằng prompt.

### C. Hỏi đáp bên ngoài và nguồn web

Với Gemini, đặt `AI_WEB_SEARCH=1`, khởi động lại server và hỏi một câu ngoài hệ thống cần nguồn. Backend dùng Gemini `generateContent` với công cụ Google Search; nhánh tra cứu/tác vụ vẫn dùng giao thức OpenAI-compatible.

Chỉ khi provider trả grounding, giao diện mới có nguồn web tương ứng. Không có nguồn phải nêu chưa có nguồn web được xác minh. Model không hỗ trợ, quota hết hoặc mạng lỗi có thể khiến luồng này lỗi dù `check:ai` đã đạt. Gợi ý tìm kiếm của provider được cách ly trong iframe sandbox. Tắt bằng `AI_WEB_SEARCH=0`.

Luồng web chỉ gửi câu hỏi hiện tại, không kèm lịch sử hoặc bảng dữ liệu nội bộ. Không nhập hồ sơ sinh viên vào câu hỏi bên ngoài nếu không muốn chính câu hỏi đó gửi đến provider.

### D. Phân biệt các phép kiểm tra

| Kiểm tra | Chứng minh được | Không chứng minh được |
| --- | --- | --- |
| `npm run check:ai` | Provider thật chọn lookup và diễn giải dữ liệu giả lập | Assist, xác nhận, Google Search, dữ liệu trường thật |
| Thử UI với model/key thật | Luồng đã thử hoạt động với provider hiện tại | Mọi model, mọi vai trò/tác vụ khác |
| `npm run check:local` | Các kiểm tra local với DB cô lập | Kết nối AI ngoài Internet |
| `npm test` | Nghiệp vụ và giao thức được kiểm thử, có HTTP giả lập | Gemini/Ollama hoặc Google Search thật |

V06.21 đã qua 221 kiểm thử và luồng xác nhận cục bộ trên Chromium. Provider thao tác/web được kiểm tra bằng mô phỏng giao thức; chưa dùng key thật để xác nhận dịch vụ AI, chưa kiểm chứng MySQL thực tế trong môi trường kiểm tra này.

## 5. Code nằm ở đâu?

| Thành phần | File |
| --- | --- |
| Nhập câu hỏi và hiển thị hội thoại/đề xuất | `frontend/src/features/chatbot/chat-widget.js`, `chat-panel.js` |
| HTTP routes AI | `backend/src/modules/ai/ai.routes.js` |
| Hội thoại, lưu lịch sử và điều phối | `backend/src/modules/ai/ai.service.js`, `assistant-turn.js` |
| Lookup/model diễn giải | `backend/src/modules/ai/ai-provider.js` |
| SQL tra cứu và phạm vi quyền | `backend/src/modules/ai/ai-tools.js` |
| Model trích tác vụ, hỏi đáp và Google Search | `backend/src/modules/ai/assistant-provider.js` |
| Tên tác vụ/trường tham số được phép | `backend/src/modules/ai/action-registry.js` |
| Chuẩn bị, validation/rollback, xác nhận/hủy | `backend/src/modules/ai/action-engine.js` |
| Cấu hình key trong Terminal | `scripts/configure-ai.mjs` |
| Kiểm tra provider lookup thật | `scripts/check-ai.mjs` |

Luồng đọc: frontend gửi câu hỏi → backend xác thực → mô hình chọn lookup → backend kiểm tra ý định/phạm vi rồi truy vấn DB → mô hình diễn giải dữ liệu được phép → giao diện hiển thị.

Luồng ghi: nhận yêu cầu → đối chiếu catalog và quyền → hỏi thiếu/không rõ → chạy validation bằng nghiệp vụ có sẵn trong savepoint rồi rollback → lưu bản đề xuất phía server → người dùng bấm xác nhận → kiểm tra lại phiên/quyền/revision/nghiệp vụ → ghi trong giao dịch và trả kết quả. Trình duyệt không được sửa payload khi xác nhận. Mô hình không được chạy SQL hoặc URL ghi tùy ý.

## 6. Muốn thêm tác vụ AI mới

1. Xác định thao tác giao diện/service hiện có, vai trò và phạm vi dữ liệu được phép. Nếu chưa có nghiệp vụ backend thì làm nghiệp vụ đó trước.
2. Khai báo tên và trường thông tin trong `action-registry.js`; chỉ cho phép dữ liệu cần thiết, quy định trường bắt buộc và cách tra mã từ tập tham chiếu theo quyền.
3. Nối tác vụ trong `action-engine.js` với handler/service đang dùng. Bảo đảm đường chạy chuẩn bị không để lại ghi dữ liệu hoặc tác dụng bên ngoài; dùng cơ chế giao dịch hiện có.
4. Cập nhật schema/định nghĩa công cụ nếu tác vụ cần tham số mới. Không mở quyền bằng prompt và không cho model tự tạo câu SQL.
5. Kiểm thử thiếu trường, nhập mơ hồ, vượt quyền, chuẩn bị không ghi, hủy, xác nhận, quá hạn, dữ liệu thay đổi, xác nhận lặp và rollback khi lỗi.
6. Thử câu tự nhiên với provider thật, kiểm tra bản xem trước và kết quả trong giao diện, cập nhật tài liệu tác vụ.

Không chỉ thêm câu mẫu vào prompt rồi coi tác vụ đã tích hợp. Provider chỉ đề xuất dữ liệu; backend vẫn quyết định quyền và tính hợp lệ.

## 7. Lỗi kết nối

- 401/403: key hoặc quyền truy cập; không chụp/gửi nguyên key.
- 404: sai endpoint/model hoặc model không có trong tài khoản.
- 429: hạn mức của provider.
- Timeout: kiểm tra mạng, provider và tốc độ model local; không tăng vượt giới hạn 30000 ms trong code hiện tại.
- Không chọn được tool: model/giao thức chưa tương thích; thử lại với model hỗ trợ, kiểm tra lookup và assist riêng.
- Thay `.env` chưa tác dụng: dừng và chạy lại backend.
- `ai:setup` yêu cầu Terminal: chạy trong VS Code Terminal tương tác, không chạy qua cửa sổ chỉ hiển thị output.

Xem thêm [lỗi khởi động/database trong README](../README.md#xử-lý-lỗi-thường-gặp).
