const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..');
const indexHtml = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/app.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/styles.css'), 'utf8');

test('拍照台默认不自动打开摄像头，必须由用户手动开启', () => {
  assert.match(indexHtml, /id="startCameraButton"/);
  assert.match(indexHtml, /id="stopCameraButton"/);
  assert.match(indexHtml, /id="refreshDevicesButton"/);
  assert.match(indexHtml, /id="browserDevicesList"/);
  assert.match(indexHtml, /id="systemDevicesList"/);
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

test('拍照台显示浏览器和系统摄像头枚举差异，并支持关闭当前流后重扫', () => {
  assert.match(appJs, /refreshDeviceInventory/);
  assert.match(appJs, /fetch\('\/api\/system-cameras'\)/);
  assert.match(appJs, /renderDeviceDiagnostics/);
  assert.match(appJs, /if \(stream\) stopCamera\(\);/);
  assert.match(appJs, /jack’s iPhone Camera/);
});

test('拍照台支持从 macOS 系统摄像头开启原生取景并保存当前帧', () => {
  assert.match(indexHtml, /id="systemDeviceSelect"/);
  assert.match(indexHtml, /id="nativePreview"/);
  assert.match(indexHtml, /id="startNativePreviewButton"/);
  assert.match(indexHtml, /id="stopNativePreviewButton"/);
  assert.match(indexHtml, /id="nativeCaptureButton"/);
  assert.match(appJs, /startNativePreview/);
  assert.match(appJs, /stopNativePreview/);
  assert.match(appJs, /captureNativeFrame/);
  assert.match(appJs, /\/api\/native-preview\/start/);
  assert.match(appJs, /\/api\/native-preview\/frame/);
  assert.match(appJs, /\/api\/native-preview\/stop/);
  assert.match(appJs, /nativePreviewRefreshTimer/);
  assert.match(appJs, /nativePreview\.src/);
  assert.match(appJs, /drawImage\(\s*nativePreview/);
  assert.doesNotMatch(appJs, /fetch\('\/api\/native-captures'/);
  assert.match(appJs, /systemDeviceSelect\.value/);
  assert.match(stylesCss, /\.preview-wrap > video,\s*\.preview-wrap > \.native-preview/);
  assert.match(stylesCss, /video\[hidden\]/);
  assert.match(stylesCss, /display: none !important/);
});
