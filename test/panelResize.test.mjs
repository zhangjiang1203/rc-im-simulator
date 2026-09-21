import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appUrl = 'http://127.0.0.1:4178';
let browser;
let server;

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(appUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Vite did not start in time');
}

async function openApp() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(appUrl);
  return page;
}

async function panelWidths(page) {
  const compose = await page.locator('.col-compose').boundingBox();
  const log = await page.locator('.col-log').boundingBox();
  return { compose: compose.width, log: log.width };
}

before(async () => {
  server = spawn(
    process.execPath,
    ['./node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4178', '--strictPort'],
    { cwd: projectRoot, stdio: 'ignore' },
  );
  await waitForServer();
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  server?.kill('SIGTERM');
});

test('桌面端默认消息编辑区比日志区更宽', async () => {
  const page = await openApp();
  const separator = page.getByRole('separator', { name: '调整消息编辑与日志区域宽度' });
  const widths = await panelWidths(page);

  assert.equal(await separator.count(), 1);
  assert.ok(widths.compose > widths.log);
  assert.ok(widths.log >= 440);
  await page.close();
});

test('向右拖拽分隔条时日志区不会小于 440px', async () => {
  const page = await openApp();
  const separator = page.getByRole('separator', { name: '调整消息编辑与日志区域宽度' });
  const box = await separator.boundingBox();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(1500, box.y + box.height / 2);
  await page.mouse.up();

  const widths = await panelWidths(page);
  assert.ok(widths.log >= 440);
  await page.close();
});

test('刷新页面后恢复默认宽度', async () => {
  const page = await openApp();
  const separator = page.getByRole('separator', { name: '调整消息编辑与日志区域宽度' });
  const initial = await panelWidths(page);
  const box = await separator.boundingBox();

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 100, box.y + box.height / 2);
  await page.mouse.up();
  const resized = await panelWidths(page);
  assert.ok(resized.compose < initial.compose - 80);

  await page.reload();
  const restored = await panelWidths(page);
  assert.ok(Math.abs(restored.compose - initial.compose) < 1);
  await page.close();
});

test('批量发送次数允许输入 100000 次', async () => {
  const page = await openApp();
  const countInput = page.locator('label:has-text("Count")').locator('xpath=following-sibling::input');

  await countInput.fill('100000');

  assert.equal(await countInput.inputValue(), '100000');
  await page.close();
});
