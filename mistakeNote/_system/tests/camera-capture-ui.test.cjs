const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

// 从 mistakeNote/_system/tests/ 上 3 层到 childLearn 仓库根；tools/ 现在在根级
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const indexHtml = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/app.js'), 'utf8');
const stylesCss = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/styles.css'), 'utf8');
const uiJs = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/ui.js'), 'utf8');
const cameraJs = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/camera-handler.js'), 'utf8');
const annotationJs = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/annotation-handler.js'), 'utf8');
const recentJs = fs.readFileSync(path.join(repoRoot, 'tools/camera-capture/src/public/recent-handler.js'), 'utf8');

test('拍照台默认不自动打开摄像头，由用户手动开启，并有相应按钮事件绑定', () => {
  assert.match(indexHtml, /id="startCameraButton"/);
  assert.match(indexHtml, /id="stopCameraButton"/);
  assert.match(indexHtml, /id="refreshDevicesButton"/);
  assert.match(indexHtml, /id="deviceSelect"/);
  
  // 底部日志栏诊断列表
  assert.match(indexHtml, /id="browserDevicesList"/);
  assert.match(indexHtml, /id="systemDevicesList"/);
  
  assert.match(appJs, /startCameraButton\.addEventListener\('click'/);
  assert.match(appJs, /stopCameraButton\.addEventListener\('click'/);
});

test('摄像头开启后按设备能力渲染可用控制项，支持软硬件切换调节', () => {
  assert.match(indexHtml, /id="cameraControls"/);
  assert.match(indexHtml, /id="controlsList"/);
  assert.match(indexHtml, /id="softwareControlsList"/);
  assert.match(indexHtml, /capture-effects\.js/);
  
  // 核心调节逻辑
  assert.match(cameraJs, /getCapabilities\(\)/);
  assert.match(cameraJs, /applyConstraints/);
  assert.match(cameraJs, /renderAdjustmentPanels/);
  assert.match(cameraJs, /renderSoftwareControlsList/);
  assert.match(cameraJs, /computeZoomCrop/);
  assert.match(cameraJs, /software_adjustments/);
  assert.match(cameraJs, /zoom/);
  assert.match(cameraJs, /brightness/);
  assert.match(cameraJs, /focusDistance/);
});

test('拍照台支持 4K 优先采集并显示实际视频流分辨率', () => {
  assert.match(indexHtml, /id="resolutionMode"/);
  assert.match(indexHtml, /id="actualResolution"/);
  assert.match(indexHtml, /最高分辨率/);
  assert.match(cameraJs, /3840/);
  assert.match(cameraJs, /2160/);
  assert.match(cameraJs, /updateActualResolution/);
  assert.match(appJs, /resolutionMode\.addEventListener\('change'/);
});

test('拍照台支持在预览画面上做红色/多种颜色矩形圆形和自由画笔/擦除/区域截图标注', () => {
  assert.match(indexHtml, /id="annotationCanvas"/);
  assert.match(indexHtml, /id="annotationToolbar"/);
  assert.match(indexHtml, /data-tool="rect"/);
  assert.match(indexHtml, /data-tool="circle"/);
  assert.match(indexHtml, /data-tool="pen"/);
  assert.match(indexHtml, /data-tool="eraser"/);
  assert.match(indexHtml, /data-tool="crop"/);
  assert.match(indexHtml, /id="colorPicker"/);
  assert.match(indexHtml, /id="undoButton"/);
  assert.match(indexHtml, /id="clearAnnotationsButton"/);
  
  assert.match(annotationJs, /currentTool/);
  assert.match(annotationJs, /currentColor/);
  assert.match(annotationJs, /drawOnCapture/);
  assert.match(annotationJs, /undoButton/);
  assert.match(annotationJs, /cropBox/);
  assert.match(annotationJs, /canvas\.addEventListener\('pointerdown'/);
});

test('拍照台统一整合常规WebRTC与系统FFmpeg设备，支持切换与停止', () => {
  assert.match(cameraJs, /detectDevices/);
  assert.match(cameraJs, /fetch\('\/api\/system-cameras'\)/);
  assert.match(cameraJs, /webrtc:/);
  assert.match(cameraJs, /native:/);
  assert.match(cameraJs, /stop\(\)/);
});

test('拍照台支持系统级原生取景会话管理，并在停止时通知后端', () => {
  assert.match(indexHtml, /id="nativePreview"/);
  assert.match(cameraJs, /startNativePreview/);
  assert.match(cameraJs, /stop/);
  assert.match(cameraJs, /\/api\/native-preview\/start/);
  assert.match(cameraJs, /\/api\/native-preview\/frame/);
  assert.match(cameraJs, /\/api\/native-preview\/stop/);
  assert.match(cameraJs, /nativeRefreshTimer/);
  assert.match(cameraJs, /nativePreview\.src/);
  assert.match(cameraJs, /drawImage\(\s*source/);
  assert.match(stylesCss, /\.preview-wrap video,\s*\.preview-wrap \.native-preview/);
  assert.match(stylesCss, /\[hidden\]/);
});

test('拍照台支持错题元数据预设、多态 A4 辅助线切换、快门闪屏/Toast 反馈与最近拍摄删除', () => {
  // 元数据预设元素
  assert.match(indexHtml, /id="presetSubject"/);
  assert.match(indexHtml, /id="presetDifficulty"/);
  assert.match(indexHtml, /id="presetNotes"/);
  assert.match(uiJs, /presetSubject:\s*document\.getElementById/);
  assert.match(cameraJs, /presetSubject/);

  // A4 参考框多态切换
  assert.match(indexHtml, /id="a4GuideMode"/);
  assert.match(indexHtml, /id="a4Guide"/);
  assert.match(uiJs, /a4GuideMode:\s*document\.getElementById/);
  assert.match(appJs, /a4GuideMode\.addEventListener\('change'/);
  assert.match(stylesCss, /\.a4-guide\.a4-portrait/);
  assert.match(stylesCss, /\.a4-guide\.a4-landscape/);
  assert.match(stylesCss, /\.a4-guide\.a4-off/);

  // 快门与 Toast 提示
  assert.match(indexHtml, /id="toastContainer"/);
  assert.match(indexHtml, /id="shutterFlash"/);
  assert.match(uiJs, /showToast/);
  assert.match(cameraJs, /shutterFlash/);
  assert.match(stylesCss, /\.shutter-flash/);
  assert.match(stylesCss, /\.toast-container/);

  // 最近拍摄删除
  assert.match(recentJs, /delete-btn/);
  assert.match(recentJs, /method:\s*'DELETE'/);
  assert.match(stylesCss, /\.delete-btn/);

  // 重构：全屏按钮与绝对悬浮工具栏
  assert.match(indexHtml, /id="fullscreenToggleBtn"/);
  assert.match(indexHtml, /id="toolbarToggleBtn"/);
  assert.match(uiJs, /fullscreenToggleBtn:\s*document\.getElementById/);
  assert.match(uiJs, /toolbarToggleBtn:\s*document\.getElementById/);
  assert.match(appJs, /fullscreenToggleBtn\.addEventListener\('click'/);
  assert.match(appJs, /toolbarToggleBtn\.addEventListener\('click'/);
  assert.match(stylesCss, /\.left-toolbar\s*\{\s*position:\s*absolute/);
  assert.match(stylesCss, /\.preview-wrap:fullscreen/);

  // 重构：面板折叠（recentCapturesToggle 已在 UI 重构时移除，最近拍摄面板与中区等高，不再折叠）
  assert.match(indexHtml, /id="cameraControlsToggle"/);
  assert.match(appJs, /cameraControlsToggle\.addEventListener\('click'/);
});
