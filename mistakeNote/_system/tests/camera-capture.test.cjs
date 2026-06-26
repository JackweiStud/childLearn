const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createCaptureStore } = require('../../tools/camera-capture/src/capture-store.cjs');

test('保存 USB 摄像头抓拍为按日期分类的 JPG 和同名 JSON 元数据', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mistake-camera-'));
  const fixedDate = new Date('2026-06-24T13:05:01.000Z');
  const store = createCaptureStore({
    repoRoot: rootDir,
    now: () => fixedDate,
  });

  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0xff, 0xd9]);
  const result = await store.saveCapture({
    imageBuffer: jpegBytes,
    mimeType: 'image/jpeg',
    deviceLabel: 'USB Camera',
    width: 1920,
    height: 1080,
    quality: {
      exposure: 'ok',
      brightness: 132,
    },
  });

  assert.equal(result.relativeImagePath, '_inbox/scans/2026-06-24/20260624-210501-usb-camera-001.jpg');
  assert.equal(result.relativeMetaPath, '_inbox/scans/2026-06-24/20260624-210501-usb-camera-001.json');
  assert.equal(fs.readFileSync(result.imagePath).toString('hex'), jpegBytes.toString('hex'));

  const meta = JSON.parse(fs.readFileSync(result.metaPath, 'utf8'));
  assert.equal(meta.captured_at, '2026-06-24T21:05:01+08:00');
  assert.equal(meta.source, 'usb-camera');
  assert.equal(meta.device_label, 'USB Camera');
  assert.equal(meta.width, 1920);
  assert.equal(meta.height, 1080);
  assert.equal(meta.stage, 'raw_scan');
  assert.equal(meta.status, 'unprocessed');
  assert.deepEqual(meta.quality, { exposure: 'ok', brightness: 132 });
});

