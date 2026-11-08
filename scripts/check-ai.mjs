// Kiểm tra THẬT mô hình đã cấu hình; không ghi vào database hoặc gửi thông tin sinh viên.
import { verifyProvider } from '../backend/src/modules/ai/ai-provider.js';
try {
  const outcome = await verifyProvider();
  console.log('ĐẠT: Mô hình AI trả lời qua HTTP và chọn được công cụ tra cứu.');
  console.log('Mô hình:', outcome.model);
  console.log('Thời điểm:', outcome.checkedAt);
  console.log(outcome.note);
} catch (error) {
  console.error('KHÔNG ĐẠT: Chưa xác nhận được AI thực sự tích hợp.');
  console.error(error.message);
  process.exitCode = 1;
}
