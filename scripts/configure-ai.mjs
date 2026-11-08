// Cấu hình Gemini một lần từ Terminal. Khóa được ghi vào .env (đã có trong .gitignore).
// Không thêm khóa vào source, frontend, README hoặc gói ZIP.
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SETTINGS = {
  AI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai',
  AI_MODEL: 'gemini-2.5-flash',
  AI_TIMEOUT_MS: '30000',
  AI_REQUIRE_LIVE: '1'
};

export function configureGeminiEnv(text, key) {
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(key)) {
    throw new Error('Khóa Gemini không hợp lệ: chỉ chấp nhận chữ, số, gạch ngang và gạch dưới (20–256 ký tự).');
  }
  let lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const [name, value] of Object.entries({ AI_API_KEY: key, ...SETTINGS })) {
    const pattern = new RegExp(`^\\s*${name}\\s*=`);
    const index = lines.findIndex(line => pattern.test(line));
    if (index >= 0) {
      lines[index] = `${name}=${value}`;
      // Không để hai giá trị cùng tên trong .env vì gây khó hiểu khi cấu hình.
      lines = lines.filter((line, i) => i === index || !pattern.test(line));
    } else {
      lines.push(`${name}=${value}`);
    }
  }
  return lines.join('\n').replace(/\n*$/, '\n');
}

function secretInput(label) {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error('Hãy chạy npm run ai:setup trong Terminal VS Code để nhập khóa an toàn.');
  const input = process.stdin, output = process.stdout;
  const oldRaw = input.isRaw || false;
  output.write(label);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  return new Promise((resolveInput, reject) => {
    let value = '';
    const finish = () => {
      input.off('data', onData);
      input.setRawMode(oldRaw);
      input.pause();
      output.write('\n');
    };
    function onData(chunk) {
      for (const c of chunk) {
        if (c === '\n' || c === '\r') { finish(); resolveInput(value.trim()); return; }
        if (c === '\u0003') { finish(); reject(new Error('Đã hủy nhập khóa.')); return; }
        if (c === '\b' || c === '\u007f') { value = value.slice(0, -1); continue; }
        if (c >= ' ' && c !== '\u007f' && value.length < 256) value += c;
      }
    }
    input.on('data', onData);
  });
}

async function run() {
  const key = await secretInput('Dán Gemini API key (ký tự không hiển thị), rồi nhấn Enter: ');
  const file = resolve('.env');
  let existing;
  try { existing = await readFile(file, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    existing = await readFile(resolve('.env.example'), 'utf8');
  }
  const configured = configureGeminiEnv(existing, key);
  await writeFile(file, configured, { encoding: 'utf8', mode: 0o600 });
  try { await chmod(file, 0o600); } catch { /* Windows kiểm soát quyền bằng ACL. */ }
  console.log('Đã cấu hình Gemini 2.5 Flash trong .env, không hiển thị hoặc lưu khóa vào mã nguồn.');
  console.log('Tiếp theo: npm run check:ai   (cần Internet và API key hợp lệ)');
  console.log('Sau đó:   npm run dev');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await run(); }
  catch (error) { console.error('Không thể cấu hình AI:', error.message); process.exitCode = 1; }
}
