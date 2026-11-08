# Lac Hong University — V06.21

Cổng thông tin đại học với nhận diện mới, ưu tiên trải nghiệm sinh viên và giảng viên. Logo SVG gốc lấy ý tưởng chim Lạc vươn lên từ trang sách; xanh đại học, trắng ngà và vàng đồng. Đây là nhận diện thiết kế cho dự án, không sử dụng logo chính thức của một trường.

**Chạy:** `npm ci`, `npm run dev`, mở http://localhost:5173. Quản trị: **quantri / Hocvu@2026**; cán bộ: cb001; giảng viên: gv001; sinh viên: 20240001; cùng mật khẩu demo. Đây là dữ liệu giả.

**Sinh viên:** khu chào cá nhân, thẻ thông tin, truy cập nhanh, tín chỉ/GPA/công nợ, lịch tuần, tiến độ chương trình, việc cần quan tâm và học phần. **Giảng viên:** lịch dạy, lớp phụ trách, sổ điểm, lớp cố vấn. Các trang nghiệp vụ dùng cùng hệ thống màu, tiêu đề, bảng, nút, menu và trạng thái biểu mẫu.

**Dữ liệu cũ:** dừng ứng dụng, sao lưu thư mục `backend/data` và `.env`, đưa dữ liệu/cấu hình đang dùng sang thư mục bản mới trước khi chạy. Không xóa dữ liệu để đổi nhận diện. Thông tin đăng nhập, API và cơ chế phân quyền được giữ tương thích. Bộ SQL tham chiếu 36 bảng không đổi.

**Mới trong V06.21:** trợ lý thao tác theo vai trò, hỏi thiếu thông tin, xem trước và xác nhận mới lưu; 36 tác vụ được kết nối. Hỏi đáp ngoài hệ thống hỗ trợ mô hình và Google Search khi dùng Gemini. Xem `docs/TRO_LY_THAO_TAC_V06_21.md`. Muốn hiểu câu tự nhiên cần cấu hình API key qua `npm run ai:setup`; không có mô hình chỉ còn tra cứu và biểu mẫu theo từ khóa.

**Mới trong V06.20:** thời khóa biểu có số tiết/khoảng tiết, phút mỗi tiết, phút nghỉ, loại buổi và giảng viên theo từng buổi; cán bộ cấu hình và máy chủ kiểm tra khớp giờ. Có lịch tuần, danh sách chi tiết, lọc lớp và thẻ buổi học trên điện thoại. Dữ liệu cũ chưa khai báo tiết được giữ nguyên, không tự suy số tiết. Xem `docs/THOI_KHOA_BIEU_V06_20.md`.

**Mới trong V06.19:** tinh chỉnh hệ thống nút, font tiếng Việt, bảng và biểu mẫu theo hướng phẳng, gọn; trang cán bộ có bàn làm việc riêng với hàng chờ, hồ sơ mới tiếp nhận, lịch tuần và nhóm nghiệp vụ. Sửa khoảng trống lớn trước nút thao tác trên điện thoại. Chi tiết: `docs/TINH_CHINH_GIAO_DIEN_V06_19.md`.

**Mới trong V06.18:** tìm nhanh 8 dịch vụ sinh viên (có/không dấu), việc cá nhân theo hạn, buổi kế tiếp trong 14 ngày, thời gian mở đăng ký và bấm ngày để lọc lịch tuần. Bố cục riêng được phát triển từ nghiên cứu tài liệu/cổng công khai của UIT, NUS, UQ và Stanford. Xem `docs/CAI_TIEN_CONG_SINH_VIEN_V06_18.md`.

**Báo cáo và nhận diện:** `docs/LAC_HONG_V06_17.md`. Các hướng dẫn V06.14–16 trong `docs` vẫn áp dụng cho nghiệp vụ tương ứng; tên Học Vụ trong tài liệu lịch sử là tên cũ.


QLSV là một repo **JavaScript ES Modules thuần**: giao diện HTML/CSS/JS tại `frontend/`, Node.js HTTP tại `backend/`, dùng SQLite để demo nhanh hoặc MySQL nếu máy đã cài. Hai tài liệu cấu trúc được chốt là `docs/reference/QLSV_FRONTEND_V06_CAU_TRUC.txt` và `docs/reference/QLSV_BACKEND_V06_CAU_TRUC.txt`. Các màn hình và nghiệp vụ V06.11 vẫn được giữ.

## AI Gemini đã cấu hình sẵn — chỉ cần khóa cá nhân

Mã nguồn đã chọn sẵn **Gemini 2.5 Flash**, API tương thích OpenAI và chế độ **bắt buộc AI thật** (`AI_REQUIRE_LIVE=1`). Không cần sửa `ai-provider.js` hay cấu hình model thủ công.

1. Tạo API key tại [Google AI Studio](https://aistudio.google.com/apikey). Đừng gửi khóa vào chat hoặc commit lên GitHub.
2. Trong Terminal VS Code, ở thư mục gốc, chạy `npm run ai:setup`. Dán khóa khi Terminal hỏi (ký tự không hiển thị); lệnh tạo/cập nhật **`.env` nằm trong `.gitignore`**. Nếu có cấu hình MySQL từ trước thì vẫn giữ nguyên.
3. Chạy `npm run check:ai`, rồi `npm run dev`. Lệnh kiểm tra AI gọi mô hình thật hai lần (gọi công cụ + giải thích), không thay bằng kết quả giả.

Nếu không có key, bạn vẫn chạy trang web và dữ liệu Local được, nhưng chatbot ở chế độ bắt buộc AI sẽ báo chưa cấu hình, **không giả làm AI**. Muốn chủ động sử dụng Ollama, chỉnh `.env` theo tài liệu `docs/HUONG_DAN_TICH_HOP_AI.md`.

## Chạy trên Windows bằng VS Code

1. Cài **Node.js 22.13+**. Giải nén, mở thư mục dự án trong VS Code.
2. Terminal tại thư mục gốc:

   ```powershell
   npm ci
   npm run dev
   ```

3. Truy cập **http://localhost:5173**. Ở chế độ demo mặc định, trang có bốn lựa chọn vai trò và tài khoản mẫu để thực hành; đây là dữ liệu giả, không phải dữ liệu trường thật.
4. Kiểm tra nhanh mã nguồn và API local:

   ```powershell
   npm run check:local
   npm run check:ai    # cần cấu hình mô hình thật trước
   npm test
   npm run audit:source
   npm run build
   ```

`check:local` chạy **database SQLite trong RAM** và khởi động HTTP trên cổng ngẫu nhiên; **không thay đổi database thật**. Lệnh này kiểm tra cấu hình Node, dữ liệu demo, frontend/API, đăng nhập bốn vai trò, truy vấn chatbot theo quyền, và quyền truy cập. Không dùng kết quả đó để kết luận MySQL hay mô hình AI từ xa đã được thử.

## Cài database MySQL trên Local (tùy chọn)

1. Cài và khởi động MySQL 8.0.16+. Tạo database `qlsv` và người dùng có quyền làm việc trên database này (không dùng tài khoản quản trị máy chủ cho ứng dụng).
2. Sao chép `.env.example` thành `.env` rồi chỉnh:

   ```ini
   DB_DRIVER=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=qlsv
   DB_PASSWORD=mat_khau_cua_ban
   DB_NAME=qlsv
   SEED_DEMO=1
   ```

3. Chạy `npm ci`, `npm run db:init`, `npm run db:seed`, `npm run dev`. **Không nạp dữ liệu mẫu vào database chứa hồ sơ thật.**

Schema MySQL 36 bảng lõi nằm ở `backend/database/qlsv-original.sql`; các bảng hỗ trợ demo/chatbot và migration V06.11 nằm riêng. Bản V06.13 **chưa được kiểm thử trực tiếp với máy chủ MySQL trong môi trường tạo bản này**; sau khi cài, cần chạy thử từng chức năng và đối chiếu báo cáo.

## Ba chế độ chatbot

| Chế độ | Cấu hình | Mức độ hoạt động |
|---|---|---|
| Tra cứu nội bộ | Để trống `AI_API_KEY` | Hỏi theo mẫu câu, truy vấn database và kiểm tra quyền; **không phải mô hình ngôn ngữ** |
| AI qua API | `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL=https://.../v1` | Mô hình chọn công cụ tra cứu và diễn giải kết quả; cần mạng, tài khoản và API key hợp lệ |
| Mô hình AI chạy local | `AI_API_KEY=ollama`, `AI_BASE_URL=http://127.0.0.1:11434/v1`, `AI_MODEL=<mô hình của bạn>` | Chỉ chạy khi bạn đã cài, khởi động mô hình OpenAI-compatible **hỗ trợ tool calling**; không bắt buộc có Internet |

Trong `.env`, đặt `AI_REQUIRE_LIVE=1` (mặc định của `.env.example` V06.13) để bắt buộc dùng mô hình AI thật. Nếu mất mạng, chatbot **báo lỗi rõ**, không âm thầm trả lời bằng mẫu câu. Chỉ đặt `AI_REQUIRE_LIVE=0` nếu cần thực hành chế độ tra cứu dự phòng. Thời gian chờ `AI_TIMEOUT_MS` là 1000–30000 ms. Người dùng chỉ được xem dữ liệu mà backend cấp quyền. API key **chỉ đọc từ backend**, không đặt trong JS frontend.

**Kiểm chứng AI thật:** sau khi cấu hình `.env`, chạy `npm run check:ai` hoặc đăng nhập, mở chatbot và nhấn **Kiểm tra AI thật**. Lệnh gửi hai yêu cầu thật tới mô hình (chọn công cụ và diễn giải dữ liệu thử). Nếu chưa kết nối sẽ báo lỗi. Bản dựng đã kiểm thử luồng đầy đủ bằng provider mô phỏng, **chưa** dùng API key hoặc Ollama thật trong môi trường tạo bản này. Hướng dẫn từng bước Windows: `docs/BAT_DAU_GEMINI_WINDOWS.md`. Hướng dẫn AI nâng cao: `docs/HUONG_DAN_TICH_HOP_AI.md`.

## Chỗ sửa khi giáo viên yêu cầu

| Cần sửa | Vị trí |
|---|---|
| Giao diện hội thoại | `frontend/src/features/chatbot/chat-panel.js` |
| Hiển thị kết quả và nguồn AI | `frontend/src/features/chatbot/chat-results.js` |
| Xử lý câu hỏi + lịch sử | `backend/src/modules/ai/ai.service.js` |
| Kết nối mô hình và giới hạn URL | `backend/src/modules/ai/ai-provider.js` |
| Công cụ tra cứu SQL có kiểm tra quyền | `backend/src/modules/ai/ai-tools.js` |
| Cơ cấu khóa, khoa, ngành, lớp | `frontend/src/pages/academic/organization/` và `backend/src/modules/organization/` |
| Điểm, công bố, sửa điểm | `backend/src/modules/assessment/` |
| Tổng kết và cảnh báo | `backend/src/modules/student-affairs/` |
| Phiên bản chương trình, công nhận | `backend/src/modules/curriculum/` |
| Bảng SQL gốc | `backend/database/qlsv-original.sql` |

## Giới hạn và phạm vi

- V06.11 gồm các nghiệp vụ: tổ chức đào tạo, hồ sơ sinh viên, học phần, thời khóa biểu, đăng ký, điểm, kết quả học kỳ, cảnh báo, công nhận và xét tốt nghiệp. Chưa thay thế quyết định học vụ chính thức bằng quy chế chưa được cung cấp.
- Tổng kết có quy chế DEMO-01 để minh họa; không coi đó là quy chế của một trường cụ thể.
- Một số màn hình vẫn sử dụng API tương thích `/api/v1/state` và `/api/v1/changes`: **không xóa khi còn import/call**, chuyển đổi phải có test rồi mới dọn.
- Môi trường dựng hiện tại thiếu Chromium; lần thử tải trình duyệt nhận archive không hợp lệ. Vì vậy **E2E tương tác trình duyệt chưa được xác nhận**.
- V06.14 bổ sung 8 bảng hỗ trợ ảnh, sĩ số, phân công lịch, đối tượng và đăng ký chờ duyệt. Không sửa nội dung file SQL 36 bảng lõi; migration tự chạy khi khởi động, không xóa dữ liệu có sẵn.

Chi tiết kết quả kiểm chứng: `docs/BAO_CAO_V06_13.md`.

## Rà soát giao diện Local (bản điều chỉnh UI/UX)

Các điều chỉnh về cỡ chữ, vùng chạm và chatbot mobile được đặt trong `frontend/src/styles/responsive.css`, không sửa CSS biên dịch. Có thêm 5 smoke test UI để kiểm tra giao diện chatbot và mapping menu bốn vai trò. Xem `docs/BAO_CAO_RAO_SOAT_UIUX_LOCAL.md` để biết phần đã sửa, kết quả kiểm thử và checklist cần thực hành trên trình duyệt trước khi bảo vệ.
