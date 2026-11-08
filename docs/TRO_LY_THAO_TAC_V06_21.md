# Lac Hong University V06.21 — Trợ lý thao tác theo vai trò

Ngày 09/11/2026. Nâng cấp từ bản V06.20. CSDL 36 bảng tham chiếu vẫn giữ nguyên; bổ sung bảng mở rộng lưu đề xuất AI.

## Cách sử dụng

Mở chatbot và nói tác vụ muốn làm. Với mô hình đã cấu hình, AI trích thông tin, đối chiếu mã/tên trong dữ liệu được phép xem và hỏi những trường còn thiếu. Khi đủ thông tin, hệ thống kiểm tra thử bằng đúng nghiệp vụ của ứng dụng rồi hoàn tác; chỉ tạo bản xem trước, chưa ghi nghiệp vụ.

Kiểm tra các trường trong bản xem trước, bấm Xác nhận để thực hiện hoặc Hủy để bỏ. Gõ “đồng ý” không tự ghi dữ liệu. Mỗi đề xuất chỉ dùng một lần, có hiệu lực 10 phút và gắn với tài khoản/phiên/quyền hiện tại. Dữ liệu đã thay đổi thì phải chuẩn bị lại; không tự chấp thuận lại trên dữ liệu mới.

Ví dụ với mô hình AI:

- Sinh viên: “Đăng ký lớp IT302-261-01 cho tôi”. Xác nhận chỉ gửi đăng ký chờ cán bộ; chưa tự có chỗ hoặc lịch học.
- Cán bộ: “Thêm khóa K30, tên Khóa tuyển sinh 2030”. Nếu thiếu năm, AI hỏi lại. Hoặc “Thêm ngành … thuộc khoa …”; không rõ khoa nào thì cần mã chính xác.
- Cán bộ: “Phân sinh viên 20240001 vào lớp …, căn cứ …”. Hệ thống vẫn kiểm tra chương trình, sĩ số và trùng lịch.
- Cán bộ: “Xếp lớp … thứ Hai 07:30–10:00, từ … đến …, phòng …, giáo viên …, 3 tiết ×45 phút và 15 phút nghỉ”. Thiếu phòng, ngày hoặc giáo viên sẽ được hỏi thêm.
- Giảng viên: “Sửa điểm quá trình thành 8 và giữa kỳ thành 7 cho sinh viên … trong lớp …”. Chỉ áp dụng điểm nháp của lớp được phân công; không đổi điểm đã công bố hoặc điểm thi.

Không có API key thì không giả làm AI: chỉ hỗ trợ tra cứu sẵn có và biểu mẫu hội thoại theo từ khóa như “Thêm khoa mới”, sau đó nhập “mã: …; tên: …”. Câu tự nhiên phức tạp, xếp lịch và hỏi đáp ngoài lề cần mô hình thật.

## 36 tác vụ đã kết nối

| Vai trò | Tác vụ |
| --- | --- |
| Sinh viên | Gửi đăng ký học phần, rút yêu cầu đang chờ, hủy đăng ký trong thời hạn |
| Cán bộ | Thêm/sửa/xóa khóa, khoa, ngành, chương trình, lớp hành chính; thêm hồ sơ sinh viên; mở/sửa/xóa hoặc hủy lớp học phần; thêm/sửa/xóa buổi học; gán/gỡ đối tượng theo khóa/khoa/ngành/lớp; phân sinh viên đích danh; duyệt/từ chối đăng ký; lưu điểm nháp |
| Giảng viên | Lưu điểm quá trình/giữa kỳ nháp trong lớp được giao |
| Quản trị | Thêm/sửa/xóa phòng; thêm hồ sơ giảng viên/cán bộ; thêm năm học và học kỳ |

Một tác vụ có thể dùng chung vai trò. Catalog có tổng cộng 36 tên tác vụ; API GET `/api/v1/ai/actions` chỉ trả danh sách tài khoản được dùng. AI không tự nâng vai trò, không chạy SQL, không gọi URL ghi tùy ý. Các chức năng chưa có trong catalog vẫn phải dùng giao diện thông thường; bản này chưa phủ toàn bộ nút của ứng dụng, chưa tự tối ưu một thời khóa biểu toàn trường hoặc ghi hàng loạt chuỗi tác vụ phụ thuộc nhau. Tác vụ nhiều bước được chuẩn bị và xác nhận lần lượt.

## Hỏi đáp ngoài hệ thống

Cấu hình mô hình bằng `npm run ai:setup`, sau đó `npm run check:ai` theo hướng dẫn AI hiện có. Với Gemini, `AI_WEB_SEARCH=1` trong `.env` bật công cụ Google Search cho câu hỏi bên ngoài. Phần trả lời hiển thị nguồn và gợi ý tìm kiếm nếu nhà cung cấp thực sự trả dữ liệu grounding. Không có nguồn thì nêu rõ chưa có nguồn web được xác minh. Nhà cung cấp/model cần hỗ trợ tính năng và hạn mức API tương ứng.

Với provider khác (ví dụ Ollama), phần ngoài lề là kiến thức mô hình, không mặc định có tìm kiếm thời gian thực. Tác vụ nghiệp vụ không nhận chỉ dẫn từ kết quả web. Yêu cầu ngoài lề không được gửi lịch sử/bảng dữ liệu nội bộ sang công cụ tìm kiếm; chỉ gửi chính câu hỏi người dùng. Không chuyển đoạn HTML nhà cung cấp vào DOM chính: gợi ý tìm kiếm được cách ly trong iframe sandbox, không chạy script.

Tài liệu tham khảo kỹ thuật chính thức: https://ai.google.dev/gemini-api/docs/generate-content/google-search

## Kiểm soát và dữ liệu

- Tác vụ dùng lại các service/handler đang phục vụ giao diện, gồm quyền, validation, học vụ, sĩ số, lịch và nhật ký.
- Chạy thử validation trong savepoint rồi rollback trước khi cho xác nhận; khi thực thi kiểm tra lại quyền hiện tại, phiên, revision và nghiệp vụ. Giao dịch lồng nhau dùng cùng giao dịch ngoài để không commit dở.
- Payload đề xuất lưu ở máy chủ; trình duyệt chỉ gửi quyết định confirm/cancel, không sửa payload khi xác nhận.
- Xác nhận lại cùng ID trả kết quả cũ, không ghi lần hai. Bản nháp mới thay thế đề xuất trước trong cùng hội thoại; có nhật ký chuẩn bị/xác nhận/hủy.
- Khi xem lại hội thoại, đề xuất cũ không còn phiên/vai trò hoặc quyền lớp phù hợp được che nội dung. Dữ liệu đọc học vụ vẫn dùng kiểm tra phạm vi hiện có.
- Bổ sung bảng `ai_action_proposals`; migration tự chạy, có thể chạy lại. Không đưa `.env`, API key hoặc dữ liệu cá nhân vào ZIP/GitHub.

## Kiểm chứng

221 kiểm thử tự động bao gồm nghiệp vụ cũ và các kiểm thử mới: chưa xác nhận không ghi, dữ liệu thiếu, xem trước/rollback, xác nhận lặp, quyền, payload bị sửa, quá hạn/stale, thay thế bản nháp, sinh viên đăng ký vẫn chờ duyệt, điểm theo phân công, xếp lịch/tiết/trùng giáo viên, rollback giao dịch lồng nhau. Mô phỏng HTTP provider kiểm tra trích thông tin/hỏi lại và giao thức Google Search/nguồn; đây không phải xác nhận bằng khóa Gemini thật.

Đã thử luồng thật trên Chromium: cán bộ thêm khoa và sinh viên đăng ký qua hội thoại, hỏi thiếu thông tin, xem trước và bấm xác nhận; máy tính và điện thoại. Rà 35 trang ở bốn kích thước, 140 lượt. Kiểm tra local 7/7, audit nguồn và build.

Chưa kiểm chứng Gemini/Ollama thật, tìm kiếm web thật hoặc MySQL trong môi trường này. Trước khi sử dụng câu tự nhiên trên máy của bạn, cấu hình key và kiểm tra mô hình. Nâng cấp vẫn cần dừng ứng dụng, sao lưu `backend/data` và `.env`, chuyển sang bản mới rồi chạy `npm ci`, `npm run dev`.
