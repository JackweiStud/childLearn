const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const indexHtml = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/app.js'), 'utf8');

test('拍照台默认不自动打开摄像头，必须由用户手动开启', () => {
  assert.match(indexHtml, /id="startCameraButton"/);
  assert.match(indexHtml, /id="stopCameraButton"/);
  assert.match(indexHtml, /id="refreshDevicesButton"/);
  assert.match(indexHtml, /id="deviceSelect"/);
  assert.match(indexHtml, /点击“开启摄像头”/);
  assert.doesNotMatch(appJs, /\nboot\(\);/);
  assert.match(appJs, /startCameraButton\.addEventListener\('click'/);
  assert.match(appJs, /stopCameraButton\.addEventListener\('click'/);
});

test('摄像头开启后按设备能力渲染可用控制项', () => {
  assert.match(indexHtml, /id="cameraControls"/);
  assert.match(indexHtml, /id="controlsList"/);
  assert.match(indexHtml, /id="softwareControlsList"/);
  assert.match(indexHtml, /capture-effects\.js/);
  assert.match(appJs, /getCapabilities\(\)/);
  assert.match(appJs, /applyConstraints\(/);
  assert.match(appJs, /renderCameraControls/);
  assert.match(appJs, /renderSoftwareControls/);
  assert.match(appJs, /computeZoomCrop/);
  assert.match(appJs, /software_adjustments/);
  assert.match(appJs, /zoom/);
  assert.match(appJs, /brightness/);
  assert.match(appJs, /focusDistance/);
});

test('拍照台支持 4K 优先采集并显示实际视频流分辨率', () => {
  assert.match(indexHtml, /id="resolutionMode"/);
  assert.match(indexHtml, /id="actualResolution"/);
  assert.match(indexHtml, /最高分辨率/);
  assert.match(appJs, /3840/);
  assert.match(appJs, /2160/);
  assert.match(appJs, /updateActualResolution/);
  assert.match(appJs, /resolutionMode\.addEventListener\('change'/);
});

test('拍照台支持在预览画面上做红色矩形圆形和自由画笔标注', () => {
  assert.match(indexHtml, /id="annotationCanvas"/);
  assert.match(indexHtml, /id="annotationToolbar"/);
  assert.match(indexHtml, /data-tool="rect"/);
  assert.match(indexHtml, /data-tool="circle"/);
  assert.match(indexHtml, /data-tool="pen"/);
  assert.match(indexHtml, /id="clearAnnotationsButton"/);
  assert.match(appJs, /annotationTool/);
  assert.match(appJs, /drawAnnotationsOnCapture/);
  assert.match(appJs, /resizeAnnotationCanvas/);
  assert.match(appJs, /annotationCanvas\.addEventListener\('pointerdown'/);
});
