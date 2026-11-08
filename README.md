# Lac Hong University — QLSV V06.21

Hệ thống quản lý đại học chạy local: frontend HTML/CSS/JavaScript ES Modules và backend Node.js HTTP trong cùng repository. Mặc định dùng SQLite; có tùy chọn MySQL. Có bốn vai trò: quản trị, cán bộ, giảng viên và sinh viên.

Bản V06.21 có trợ lý AI tra cứu theo quyền, chuẩn bị thao tác để người dùng xác nhận và hỏi đáp ngoài hệ thống. **Không cần sửa mã nguồn để nhập API key.** Đây là dự án đồ án/local, chưa phải bản triển khai production đã được nghiệm thu.

## Mục lục

- [Cài và chạy trên Windows / VS Code](#cài-và-chạy-trên-windows--vs-code)
- [Tài khoản và sử dụng theo vai trò](#tài-khoản-và-sử-dụng-theo-vai-trò)
- [Bật AI](#bật-ai)
- [Database và tài khoản khởi tạo](#database-và-tài-khoản-khởi-tạo)
- [Các lệnh của dự án](#các-lệnh-của-dự-án)
- [Cấu trúc và điểm tích hợp AI](#cấu-trúc-và-điểm-tích-hợp-ai)
- [Sao lưu và nâng cấp](#sao-lưu-và-nâng-cấp)
- [Xử lý lỗi thường gặp](#xử-lý-lỗi-thường-gặp)
- [Tài liệu nghiệp vụ và phạm vi kiểm chứng](#tài-liệu-nghiệp-vụ-và-phạm-vi-kiểm-chứng)

## Cài và chạy trên Windows / VS Code

1. Cài Node.js **22.13.0 trở lên**; Node 24 đáp ứng yêu cầu của dự án.
2. Clone repository hoặc tải **Code > Download ZIP**, giải nén. Mở đúng thư mục chứa `package.json` bằng **File > Open Folder** trong VS Code.
3. Mở **Terminal > New Terminal**, chạy:

```powershell
node -v
npm -v
npm ci
npm run dev
```

Mở [http://localhost:5173](http://localhost:5173). Giữ Terminal đang chạy; dừng bằng **Ctrl+C**. Lệnh `dev` chạy cả API và giao diện, tự khởi tạo SQLite và dữ liệu demo khi cấu hình mặc định. Không cần MySQL hoặc API key chỉ để mở web và thử nghiệp vụ.

Chưa có `.env` thì thông báo `.env not found` không phải lỗi. Khi cần chỉnh cấu hình thủ công, dừng server và chạy một lần nếu chưa có file:

```powershell
Copy-Item .env.example .env
```

Sau đó chỉnh `.env` ở **gốc repository**, cùng cấp `package.json`, rồi chạy lại server. Không dùng Live Server thay cho backend. `dev:frontend` chỉ phục vụ tệp tĩnh, không cung cấp API hay đăng nhập.

## Tài khoản và sử dụng theo vai trò

Dữ liệu demo dùng chung mật khẩu **`Hocvu@2026`**. Chỉ dùng các tài khoản này trong môi trường thực hành.

| Vai trò | Tên đăng nhập | Luồng chính |
| --- | --- | --- |
| Quản trị | `quantri` | Quản lý tài khoản/vai trò, danh mục và cấu hình; xem hướng dẫn quản trị bên dưới |
| Cán bộ | `cb001` | Quản lý khóa/khoa/ngành/lớp, sinh viên, lớp học phần, lịch học và duyệt đăng ký |
| Giảng viên | `gv001` | Xem lớp/lịch được phân công, làm việc với sinh viên và điểm theo quyền |
| Sinh viên | `20240001` | Xem hồ sơ/lịch/điểm, đăng ký lớp học phần và theo dõi kết quả duyệt |

Luồng học vụ: cán bộ tạo danh mục và lớp, thêm sinh viên, mở lớp học phần và xếp buổi học; sinh viên gửi đăng ký; cán bộ duyệt theo điều kiện và sĩ số; sinh viên mới được thêm vào lớp học phần khi đăng ký được chấp thuận. Ảnh sinh viên là tùy chọn khi cán bộ tạo hồ sơ; sinh viên không tự đổi ảnh này trong hồ sơ.

Xem thao tác cụ thể tại [hướng dẫn cán bộ](docs/HUONG_DAN_CAN_BO_V06_14.md), [quản trị tài khoản](docs/HUONG_DAN_QUAN_TRI_V06_15.md), [quản trị mở rộng](docs/HUONG_DAN_QUAN_TRI_V06_16.md), [cổng sinh viên](docs/CAI_TIEN_CONG_SINH_VIEN_V06_18.md) và [thời khóa biểu, tiết học](docs/THOI_KHOA_BIEU_V06_20.md). Những tài liệu ghi phiên bản cũ mô tả lần bổ sung tính năng đó; cấu hình chạy hiện tại lấy theo README này.

## Bật AI

### Gemini: cách cài nhanh

Chuẩn bị Gemini API key của bạn từ [Google AI Studio](https://aistudio.google.com/apikey). Trong Terminal tại gốc dự án, dừng server cũ rồi chạy:

```powershell
npm run ai:setup
npm run check:ai
npm run dev
```

Dán key khi Terminal hỏi, nhấn Enter. Ký tự nhập được ẩn. Script tạo/cập nhật `.env`, giữ các cấu hình database đang có và đặt các biến AI về cấu hình Gemini mặc định. Không đưa key vào frontend, tin nhắn chatbot hoặc GitHub. Muốn dùng provider khác thì sửa `.env` theo [hướng dẫn tích hợp AI](docs/HUONG_DAN_TICH_HOP_AI.md); chạy lại `ai:setup` sẽ đưa cấu hình AI về Gemini.

Cấu hình mẫu hiện có của dự án:

```dotenv
AI_API_KEY=THAY_BANG_KEY_CUA_BAN
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
AI_MODEL=gemini-2.5-flash
AI_TIMEOUT_MS=30000
AI_REQUIRE_LIVE=1
AI_WEB_SEARCH=1
```

`AI_MODEL` phải là model được tài khoản của bạn cấp quyền và hỗ trợ các công cụ cần dùng. Mẫu mặc định trong repository không bảo đảm model/quota luôn khả dụng với mọi tài khoản. Thay đổi `.env` cần khởi động lại server.

### Cách dùng và kiểm tra

| Nhu cầu | Cách thử | Kết quả cần kiểm tra |
| --- | --- | --- |
| Tra cứu nội bộ bằng mô hình | Đăng nhập cán bộ, hỏi “Khóa K24 có bao nhiêu lớp hành chính?” | Dữ liệu trong phạm vi quyền, có nhãn AI diễn giải khi mô hình thực sự xử lý |
| AI hỏi thiếu thông tin và thêm dữ liệu | Trong DB demo, nói “Thêm khóa K30, tên Khóa tuyển sinh 2030”, dùng mã chưa tồn tại | Hỏi trường còn thiếu, hiện bản xem trước; chưa xác nhận thì chưa tạo bản ghi |
| Xác nhận thao tác | Kiểm tra bản xem trước rồi bấm **Xác nhận** hoặc **Hủy** | Xác nhận mới ghi dữ liệu; gõ “đồng ý” không thay nút xác nhận |
| Sinh viên đăng ký | Dùng mã lớp học phần đang mở và còn hạn đăng ký trong DB hiện tại | Sau xác nhận là yêu cầu chờ cán bộ duyệt, không tự được chấp thuận |
| Câu hỏi bên ngoài | Hỏi thông tin bên ngoài hệ thống cần nguồn web | Gemini có thể trả nguồn tìm kiếm; chỉ coi là có nguồn web khi API thực sự trả grounding |

**`check:ai` gọi API thật nhưng chỉ kiểm tra chọn công cụ tra cứu và diễn giải dữ liệu giả lập.** Nó chưa kiểm tra luồng AI thao tác/xác nhận hoặc tìm kiếm web. Cần thử các luồng đó trong giao diện theo bảng trên. `check:local` và `npm test` không chứng minh Gemini thật đã kết nối.

Trợ lý hiện kết nối **36 tên tác vụ** theo quyền, không bao phủ mọi nút của ứng dụng. Thiếu API key vẫn có tra cứu/biểu mẫu hội thoại theo mẫu có sẵn; đó không phải mô hình AI. `AI_REQUIRE_LIVE=1` áp dụng cho luồng tra cứu bằng mô hình, không vô hiệu hóa toàn bộ chức năng cục bộ. Xem [phạm vi AI thao tác và kiểm soát xác nhận](docs/TRO_LY_THAO_TAC_V06_21.md).

Hướng dẫn đầy đủ: [tích hợp và giải thích code AI](docs/HUONG_DAN_TICH_HOP_AI.md), [từng bước trên Windows](docs/BAT_DAU_GEMINI_WINDOWS.md).

## Database và tài khoản khởi tạo

### SQLite mặc định

```dotenv
DB_DRIVER=sqlite
SQLITE_PATH=backend/data/qlsv.db
PORT=5173
SEED_DEMO=1
```

Database lưu trên đĩa, không mất khi khởi động lại. Không xóa file DB để xử lý lỗi giao diện. Server tự khởi tạo schema/migration; `npm run db:init` cho phép chạy khởi tạo riêng. `npm run db:seed` thêm dữ liệu thực hành, chỉ dùng với database demo.

[qlsv-original.sql](backend/database/qlsv-original.sql) giữ thiết kế **36 bảng gốc** làm đối chiếu. Schema chạy thật có thêm các bảng mở rộng cho tính năng mới; không phải chỉ đúng 36 bảng. Không nhập đồng thời SQL tham chiếu và schema khởi tạo vào cùng database.

### MySQL tùy chọn

Cần MySQL 8.0.16+ và database `qlsv` đã được tạo. Ví dụ chạy bằng tài khoản có quyền tạo database/người dùng trong MySQL; thay mật khẩu mẫu trước khi dùng:

```sql
CREATE DATABASE qlsv CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'qlsv'@'127.0.0.1' IDENTIFIED BY 'THAY_MAT_KHAU_RIENG';
GRANT ALL PRIVILEGES ON qlsv.* TO 'qlsv'@'127.0.0.1';
```

Nếu database/tài khoản đã có thì kiểm tra quyền hiện tại thay vì chạy lại `CREATE`. Cấu hình `.env`:

```dotenv
DB_DRIVER=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=qlsv
DB_PASSWORD=THAY_MAT_KHAU_RIENG
DB_NAME=qlsv
SEED_DEMO=1
```

Chạy `npm run db:init`, sau đó `npm run dev` cho demo. Dữ liệu SQLite không tự chuyển sang MySQL. Nhánh MySQL có trong code nhưng chưa được kiểm chứng thực tế trong đợt kiểm tra V06.21 này.

### Khởi tạo dữ liệu riêng, không dùng tài khoản demo

Dùng **database mới chưa có người dùng**, tạo `.env` từ mẫu, đặt `SEED_DEMO=0`, chọn đường dẫn SQLite mới hoặc database MySQL riêng. Điền đủ sáu biến:

```dotenv
BOOTSTRAP_ADMIN_USERNAME=admin_rieng
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=THAY_MAT_KHAU_12_DEN_128_KY_TU
BOOTSTRAP_STAFF_USERNAME=canbo_rieng
BOOTSTRAP_STAFF_EMAIL=canbo@example.com
BOOTSTRAP_STAFF_PASSWORD=THAY_MAT_KHAU_KHAC_12_DEN_128_KY_TU
```

Thay email/mật khẩu bằng thông tin của bạn, rồi chạy `npm run db:bootstrap` và `npm start`. Script tạo hai tài khoản quản trị/cán bộ và đơn vị đào tạo tạm cần cập nhật; bắt đổi mật khẩu khi đăng nhập. Xóa sáu biến `BOOTSTRAP_*` khỏi `.env` sau khi khởi tạo. Script từ chối database đã có người dùng; không chạy `db:seed` trên bộ dữ liệu riêng này.

## Các lệnh của dự án

Chạy ở gốc repository sau `npm ci`.

| Lệnh | Công dụng |
| --- | --- |
| `npm run dev` | Chạy full-stack local; mặc định bật seed demo nếu chưa đặt `SEED_DEMO` |
| `npm start` | Chạy full-stack, đọc `.env`; không tự ép `SEED_DEMO=1` |
| `npm run db:init` | Khởi tạo/cập nhật schema của database đang cấu hình |
| `npm run db:seed` | Thêm dữ liệu demo vào database đang cấu hình |
| `npm run db:bootstrap` | Tạo quản trị/cán bộ ban đầu trên database mới |
| `npm run ai:setup` | Nhập key và cấu hình Gemini trong Terminal tương tác |
| `npm run check:ai` | Hai lời gọi mô hình thật: chọn lookup và diễn giải dữ liệu giả lập |
| `npm run check:local` | Kiểm tra local bằng SQLite cô lập; không gọi AI thật |
| `npm test` | Kiểm thử tự động, có provider giả lập |
| `npm run audit:source` | Kiểm tra cấu trúc/import nguồn |
| `npm run build` | Tạo frontend tĩnh trong `dist/`; không tạo backend/database hay tự triển khai |
| `npm run css` | Biên dịch CSS sau khi sửa theme |
| `npm run css:watch` | Theo dõi và biên dịch CSS khi phát triển giao diện |
| `npm run dev:frontend` | Phục vụ frontend tĩnh để phát triển riêng; không có API |
| `npm run dev:backend` | Chạy server backend/full-stack trực tiếp, đọc `.env` |

CSS đã biên dịch được lưu sẵn; chạy demo không cần build CSS. Đừng mở `dist/index.html` bằng `file://` để kiểm tra đăng nhập. Cách chạy đầy đủ vẫn là `dev` hoặc `start` từ gốc dự án.

## Cấu trúc và điểm tích hợp AI

| Thư mục/file | Trách nhiệm |
| --- | --- |
| `frontend/src/` | Màn hình theo vai trò, components, features, services, styles |
| `backend/src/` | HTTP server, config/core/middlewares, modules nghiệp vụ |
| `backend/database/` | Schema, migration và dữ liệu demo |
| `shared/` | Nhận diện ý định tra cứu dùng chung |
| `tests/` | Kiểm thử tự động |
| `scripts/` | Chạy local, cấu hình AI, kiểm tra và build |
| `backend/src/modules/ai/ai-provider.js` | Gọi mô hình cho tra cứu và diễn giải |
| `backend/src/modules/ai/assistant-provider.js` | Trích tác vụ, hỏi đáp ngoài lề, tích hợp Google Search với Gemini |
| `backend/src/modules/ai/action-registry.js` | Danh sách tác vụ và trường thông tin được phép |
| `backend/src/modules/ai/action-engine.js` | Chuẩn bị, kiểm tra, xác nhận/hủy thao tác |

Muốn **dùng AI hiện có**: chỉ cấu hình `.env`. Muốn **bổ sung tác vụ AI mới**: cần nối registry/engine với nghiệp vụ và quyền đã có, bổ sung kiểm thử xác nhận/rollback; không chỉ thêm câu lệnh vào prompt. Xem [hướng dẫn code AI](docs/HUONG_DAN_TICH_HOP_AI.md) và [cấu trúc V06](docs/CAU_TRUC_V06.md).

## Sao lưu và nâng cấp

1. Dừng server bằng Ctrl+C trước khi sao lưu SQLite.
2. Sao lưu toàn bộ `backend/data/` và `.env` ở chỗ riêng. Nếu dùng MySQL, xuất database bằng công cụ MySQL của bạn.
3. Nếu dùng Git, cập nhật nhánh sau khi đã giữ các sửa đổi riêng. Nếu dùng ZIP, giải nén sang thư mục mới; chuyển `.env` và dữ liệu đã sao lưu sang đúng đường dẫn cấu hình.
4. Chạy `npm ci`, `npm run check:local`, rồi `npm run dev` hoặc `npm start` theo chế độ đã chọn. Server áp dụng migration khi mở DB.
5. Kiểm tra đăng nhập, dữ liệu cũ, lịch/đăng ký và AI. Giữ bản sao lưu trước nâng cấp; khi quay về code cũ cần dùng bản DB trước nâng cấp tương ứng.

`.env`, `node_modules`, `backend/data`, file DB và `dist` được bỏ qua bởi Git. Không chép đè `.env` đang dùng bằng `.env.example`, không tải DB/key cá nhân lên repository.

## Xử lý lỗi thường gặp

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| `npm`/`node` không được nhận diện | Cài Node, mở lại Terminal/VS Code, kiểm tra `node -v` và `npm -v` |
| Không tìm thấy `package.json` | Mở Terminal đúng thư mục gốc sau khi giải nén |
| `node:sqlite` không có hoặc lỗi cú pháp Node | Kiểm tra đúng Node >=22.13.0 đang được Terminal sử dụng |
| `.env not found. Continuing without it.` | Demo SQLite vẫn chạy; chỉ tạo `.env` khi cần cấu hình riêng/AI |
| `localhost` không truy cập được | Giữ server chạy, đọc lỗi trong Terminal, mở đúng URL/PORT được in ra |
| `EADDRINUSE` | Dừng tiến trình dự án cũ hoặc đổi `PORT` trong `.env`, khởi động lại và dùng URL mới |
| Trang trắng | Chạy bằng `npm run dev`; mở F12 > Console/Network, tải lại Ctrl+F5 và kiểm tra lỗi tải JS/API; giữ thông báo lỗi để chẩn đoán |
| `npm ci` báo lockfile không khớp | Dùng `package.json` và `package-lock.json` cùng phiên bản từ repo; không xóa lockfile tùy tiện |
| Cảnh báo chặn install script `@parcel/watcher` | Nếu web vẫn chạy thì chưa phải lỗi khởi động. Khi biên dịch CSS lỗi, xem thông báo npm và kiểm tra script bằng `npm install-scripts ls` nếu phiên bản npm hỗ trợ |
| AI thiếu key hoặc báo 401/403 | Kiểm tra `.env` ở gốc, key/quyền tài khoản, khởi động lại backend; không gửi key cho người khác |
| AI 404, 429 hoặc timeout | Kiểm tra endpoint/model, quota và kết nối Internet; `AI_TIMEOUT_MS` trong khoảng 1000–30000 |
| `check:ai` đạt nhưng AI thao tác/web lỗi | Đây là các luồng khác; thử trực tiếp giao diện, kiểm tra model có hỗ trợ function calling/Google Search và đọc lỗi backend |
| AI báo thiếu thông tin/trùng mã/hết chỗ/trùng lịch | Bổ sung/sửa thông tin theo yêu cầu nghiệp vụ; xác nhận không bỏ qua validation |
| AI đề xuất hết hạn hoặc dữ liệu đã thay đổi | Chuẩn bị lại đề xuất, kiểm tra lại bản xem trước rồi xác nhận |
| Không đăng nhập được tài khoản demo | Kiểm tra đang dùng DB nào và `SEED_DEMO`; DB riêng không mặc nhiên có tài khoản demo |

## Tài liệu nghiệp vụ và phạm vi kiểm chứng

- [AI: cấu hình, luồng xử lý và code](docs/HUONG_DAN_TICH_HOP_AI.md)
- [AI: từng bước Windows / VS Code](docs/BAT_DAU_GEMINI_WINDOWS.md)
- [AI thao tác V06.21: 36 tác vụ, quyền, xác nhận và giới hạn](docs/TRO_LY_THAO_TAC_V06_21.md)
- [Thời khóa biểu V06.20](docs/THOI_KHOA_BIEU_V06_20.md)
- [Cán bộ V06.14](docs/HUONG_DAN_CAN_BO_V06_14.md), [tài khoản V06.15](docs/HUONG_DAN_QUAN_TRI_V06_15.md), [quản trị V06.16](docs/HUONG_DAN_QUAN_TRI_V06_16.md)
- [Giao diện Lac Hong V06.17](docs/LAC_HONG_V06_17.md), [sinh viên V06.18](docs/CAI_TIEN_CONG_SINH_VIEN_V06_18.md), [cán bộ V06.19](docs/TINH_CHINH_GIAO_DIEN_V06_19.md)
- [Cấu trúc code](docs/CAU_TRUC_V06.md), [đối chiếu thiết kế QLSV](docs/DOI_CHIEU_QLSV.md), [phạm vi nghiệp vụ](docs/PHAM_VI_QLSV.md), [nhật ký phiên bản](docs/NHAT_KY_PHIEN_BAN.md)

Đợt kiểm tra code V06.21: **221 kiểm thử**, kiểm tra local **7/7**, audit nguồn và build; Chromium kiểm tra 35 trang ở bốn độ rộng 1440/768/390/320 (140 lượt), cùng luồng xác nhận cán bộ/sinh viên trên máy tính và kích thước điện thoại. Giao thức AI thao tác và Google Search được kiểm tra bằng HTTP giả lập.

**Chưa kiểm chứng bằng key Gemini/Ollama thật, tìm kiếm web thật, MySQL, Windows Edge hoặc Safari trong môi trường kiểm tra này.** Các lần chạy kiểm thử trên không thay thế thử kết nối AI bằng key của bạn. Lần cập nhật README này chỉ sửa tài liệu, không thay đổi code hoặc chạy lại toàn bộ bộ kiểm thử.
