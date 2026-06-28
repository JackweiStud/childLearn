const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createCaptureStore } = require('../../../tools/camera-capture/src/capture-store.cjs');
const {
  buildAvfoundationCaptureArgs,
  buildAvfoundationPreviewArgs,
  extractJpegFrames,
  parseAvfoundationVideoDevices,
  parseFfprobeDimensions,
} = require('../../../tools/camera-capture/src/server.cjs');

test('保存 USB 摄像头抓拍为按日期分类的 JPG 和同名 JSON 元数据', async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mistake-camera-'));
  const fixedDate = new Date('2026-06-24T13:05:01.000Z');
  const store = createCaptureStore({
    outputDir: rootDir,
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
    subject: 'english',
    difficulty: 'hard',
    notes: 'Unit test preset note',
  });

  // relativePath 现在直接相对 outputDir，不再有 mistakeNote 私有的 _inbox/scans/ 层
  assert.equal(result.relativeImagePath, '2026-06-24/20260624-210501-usb-camera-001.jpg');
  assert.equal(result.relativeMetaPath, '2026-06-24/20260624-210501-usb-camera-001.json');
  assert.equal(fs.readFileSync(result.imagePath).toString('hex'), jpegBytes.toString('hex'));

  const meta = JSON.parse(fs.readFileSync(result.metaPath, 'utf8'));
  assert.equal(meta.captured_at, '2026-06-24T21:05:01+08:00');
  assert.equal(meta.source, 'usb-camera');
  assert.equal(meta.device_label, 'USB Camera');
  assert.equal(meta.width, 1920);
  assert.equal(meta.height, 1080);
  assert.equal(meta.stage, 'raw_scan');
  assert.equal(meta.status, 'unprocessed');
  assert.equal(meta.subject, 'english');
  assert.equal(meta.difficulty, 'hard');
  assert.equal(meta.notes, 'Unit test preset note');
  assert.deepEqual(meta.quality, { exposure: 'ok', brightness: 132 });
});

test('解析 ffmpeg/AVFoundation 视频设备列表用于诊断浏览器枚举差异', () => {
  const stderr = `
[AVFoundation indev @ 0x15110f2e0] AVFoundation video devices:
[AVFoundation indev @ 0x15110f2e0] [0] USB Camera
[AVFoundation indev @ 0x15110f2e0] [1] jack’s iPhone Camera
[AVFoundation indev @ 0x15110f2e0] [2] jack’s iPhone Desk View Camera
[AVFoundation indev @ 0x15110f2e0] [3] Capture screen 0
[AVFoundation indev @ 0x15110f2e0] AVFoundation audio devices:
`;

  assert.deepEqual(parseAvfoundationVideoDevices(stderr), [
    { index: 0, label: 'USB Camera' },
    { index: 1, label: 'jack’s iPhone Camera' },
    { index: 2, label: 'jack’s iPhone Desk View Camera' },
  ]);
});

test('构造原生 AVFoundation 单帧抓图命令并解析输出尺寸', () => {
  assert.deepEqual(buildAvfoundationCaptureArgs({ deviceIndex: 1, outputPath: '/tmp/iphone.jpg' }), [
    '-hide_banner',
    '-y',
    '-f',
    'avfoundation',
    '-framerate',
    '30',
    '-i',
    '1:none',
    '-frames:v',
    '1',
    '/tmp/iphone.jpg',
  ]);

  assert.deepEqual(parseFfprobeDimensions('{"streams":[{"width":1920,"height":1440}]}'), {
    width: 1920,
    height: 1440,
  });
});

test('构造原生 AVFoundation MJPEG 取景流命令', () => {
  assert.deepEqual(buildAvfoundationPreviewArgs({ deviceIndex: 2 }), [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-f',
    'avfoundation',
    '-framerate',
    '30',
    '-i',
    '2:none',
    '-an',
    '-vf',
    'fps=10,scale=1280:-2',
    '-q:v',
    '7',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    'pipe:1',
  ]);
});

test('从连续 JPEG 字节流中提取完整帧并保留未完成尾部', () => {
  const frameA = Buffer.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
  const frameB = Buffer.from([0xff, 0xd8, 0x03, 0x04, 0xff, 0xd9]);
  const partial = Buffer.from([0xff, 0xd8, 0x05]);

  const result = extractJpegFrames(Buffer.concat([frameA, frameB, partial]));

  assert.deepEqual(result.frames, [frameA, frameB]);
  assert.deepEqual(result.remainder, partial);
});
