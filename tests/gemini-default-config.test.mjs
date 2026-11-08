import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { aiEndpoint, GEMINI_BASE_URL, GEMINI_MODEL } from '../backend/src/modules/ai/ai-provider.js';
import { configureGeminiEnv } from '../scripts/configure-ai.mjs';

test('Gemini cấu hình sẵn trong code và .env.example, không nhúng khóa', async () => {
  const endpoint = aiEndpoint({});
  assert.equal(endpoint.url, GEMINI_BASE_URL + '/chat/completions');
  assert.equal(endpoint.model, GEMINI_MODEL);
  const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(template, /^AI_BASE_URL=https:\/\/generativelanguage.googleapis.com\/v1beta\/openai$/m);
  assert.match(template, /^AI_MODEL=gemini-2.5-flash$/m);
  assert.match(template, /^AI_REQUIRE_LIVE=1$/m);
  assert.match(template, /^AI_API_KEY=$/m);
});

test('Thiết lập key chỉ thay thông số AI, không xóa MySQL và không nhân đôi biến', () => {
  const key = 'AIza-testGEMINI_FAKE_KEY_123456789012';
  const current = '# cấu hình\nDB_DRIVER=mysql\nDB_PASSWORD=other-secret\nAI_API_KEY=old-placeholder\nAI_BASE_URL=https://api.openai.com/v1\nAI_MODEL=old\nAI_MODEL=duplicated\n';
  const result = configureGeminiEnv(current, key);
  assert.match(result, /DB_DRIVER=mysql/);
  assert.match(result, /DB_PASSWORD=other-secret/);
  assert.match(result, /AI_API_KEY=AIza-testGEMINI_FAKE_KEY_123456789012/);
  assert.match(result, /AI_BASE_URL=https:\/\/generativelanguage.googleapis.com\/v1beta\/openai/);
  assert.equal((result.match(/^AI_MODEL=/gm) || []).length, 1);
  assert.match(result, /^AI_REQUIRE_LIVE=1$/m);
  assert.throws(() => configureGeminiEnv(current, 'short'), /không hợp lệ/);
  assert.throws(() => configureGeminiEnv(current, 'abc\nAI_REQUIRE_LIVE=0'), /không hợp lệ/);
});
