const deviceSelect = document.getElementById('deviceSelect');
const resolutionMode = document.getElementById('resolutionMode');
const preview = document.getElementById('preview');
const annotationCanvas = document.getElementById('annotationCanvas');
const startCameraButton = document.getElementById('startCameraButton');
const stopCameraButton = document.getElementById('stopCameraButton');
const refreshDevicesButton = document.getElementById('refreshDevicesButton');
const captureButton = document.getElementById('captureButton');
const openFolderButton = document.getElementById('openFolderButton');
const qualityHint = document.getElementById('qualityHint');
const actualResolution = document.getElementById('actualResolution');
const controlsHint = document.getElementById('controlsHint');
const controlsList = document.getElementById('controlsList');
const softwareControlsList = document.getElementById('softwareControlsList');
const recentList = document.getElementById('recentList');
const scratchCanvas = document.getElementById('scratchCanvas');
const standbyOverlay = document.getElementById('standbyOverlay');
const annotationToolbar = document.getElementById('annotationToolbar');
const clearAnnotationsButton = document.getElementById('clearAnnotationsButton');

let stream = null;
let activeTrack = null;
let devices = [];
let currentDeviceLabel = '';
let lastQuality = { exposure: 'unknown', brightness: 0 };
let softwareAdjustments = CaptureEffects.normalizeSoftwareAdjustments();
let annotationTool = 'rect';
let annotations = [];
let activeAnnotation = null;

const numericControls = [
  { key: 'zoom', label: '缩放' },
  { key: 'brightness', label: '亮度' },
  { key: 'contrast', label: '对比度' },
  { key: 'saturation', label: '饱和度' },
  { key: 'sharpness', label: '锐度' },
  { key: 'exposureCompensation', label: '曝光补偿' },
  { key: 'focusDistance', label: '焦距/对焦距离' },
  { key: 'colorTemperature', label: '色温' },
];

const enumControls = [
  { key: 'focusMode', label: '对焦模式' },
  { key: 'exposureMode', label: '曝光模式' },
  { key: 'whiteBalanceMode', label: '白平衡模式' },
];

function setHint(message, tone = 'normal') {
  qualityHint.textContent = message;
  qualityHint.dataset.tone = tone;
}

async function enumerateVideoDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    setHint('当前浏览器不支持摄像头枚举。', 'error');
    return;
  }
  const allDevices = await navigator.mediaDevices.enumerateDevices();
  devices = allDevices.filter((device) => device.kind === 'videoinput');
  deviceSelect.innerHTML = '';
  for (const device of devices) {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `摄像头 ${deviceSelect.length + 1}`;
    deviceSelect.append(option);
  }
  if (devices.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '未发现摄像头';
    deviceSelect.append(option);
  }
  return devices;
}

function preferredDeviceId() {
  const usb = devices.find((device) => /usb\s*camera/i.test(device.label));
  return (usb || devices[0])?.deviceId || '';
}

function resolutionConstraints() {
  const mode = resolutionMode.value;
  if (mode === '720p') return { width: { ideal: 1280 }, height: { ideal: 720 } };
  if (mode === '1080p') return { width: { ideal: 1920 }, height: { ideal: 1080 } };
  return { width: { ideal: 3840 }, height: { ideal: 2160 } };
}

async function startCamera(deviceId) {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
  }

  const constraints = {
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      ...resolutionConstraints(),
    },
    audio: false,
  };

  stream = await navigator.mediaDevices.getUserMedia(constraints);
  preview.srcObject = stream;
  const [track] = stream.getVideoTracks();
  activeTrack = track;
  currentDeviceLabel = track.label || deviceSelect.selectedOptions[0]?.textContent || 'Unknown Camera';
  captureButton.disabled = false;
  startCameraButton.disabled = true;
  stopCameraButton.disabled = false;
  standbyOverlay.hidden = true;
  await enumerateVideoDevices();
  const active = devices.find((device) => device.label === currentDeviceLabel);
  if (active) deviceSelect.value = active.deviceId;
  renderCameraControls(track);
  updateActualResolution();
  resizeAnnotationCanvas();
  setHint(`已连接: ${currentDeviceLabel}`, 'ok');
}

function stopCamera() {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
  }
  stream = null;
  activeTrack = null;
  preview.srcObject = null;
  actualResolution.textContent = '实际分辨率: 未开启';
  currentDeviceLabel = '';
  lastQuality = { exposure: 'unknown', brightness: 0 };
  captureButton.disabled = true;
  startCameraButton.disabled = false;
  stopCameraButton.disabled = true;
  standbyOverlay.hidden = false;
  clearCameraControls('开启摄像头后显示当前设备支持的控制项。');
  setHint('摄像头已关闭。需要拍题时再开启。', 'normal');
}

function updateActualResolution() {
  if (!activeTrack && !preview.videoWidth) {
    actualResolution.textContent = '实际分辨率: 未开启';
    return;
  }
  const settings = activeTrack?.getSettings ? activeTrack.getSettings() : {};
  const width = settings.width || preview.videoWidth || 0;
  const height = settings.height || preview.videoHeight || 0;
  actualResolution.textContent = width && height
    ? `实际分辨率: ${width} × ${height}`
    : '实际分辨率: 读取中';
}

function clearCameraControls(message) {
  controlsList.innerHTML = '';
  controlsHint.textContent = message;
}

function supportsNumericControl(capability) {
  return capability
    && typeof capability.min === 'number'
    && typeof capability.max === 'number'
    && capability.min !== capability.max;
}

function currentControlValue(settings, capability, key) {
  if (typeof settings[key] === 'number') return settings[key];
  if (typeof capability.min === 'number' && typeof capability.max === 'number') {
    return (capability.min + capability.max) / 2;
  }
  return 0;
}

async function applyCameraConstraint(key, value) {
  if (!activeTrack) return;
  try {
    await activeTrack.applyConstraints({
      advanced: [{ [key]: value }],
    });
    controlsHint.textContent = `已应用: ${key} = ${value}`;
  } catch (error) {
    controlsHint.textContent = `当前设备/浏览器不支持应用 ${key}: ${error.message}`;
  }
}

function renderNumericControl({ key, label }, capability, settings) {
  const row = document.createElement('label');
  row.className = 'control-row';
  const value = currentControlValue(settings, capability, key);
  const step = typeof capability.step === 'number' && capability.step > 0 ? capability.step : 1;
  row.innerHTML = `
    <span>${label}</span>
    <input type="range" min="${capability.min}" max="${capability.max}" step="${step}" value="${value}" />
    <output>${value}</output>
  `;
  const input = row.querySelector('input');
  const output = row.querySelector('output');
  input.addEventListener('input', () => {
    output.textContent = input.value;
  });
  input.addEventListener('change', () => {
    applyCameraConstraint(key, Number(input.value));
  });
  controlsList.append(row);
}

function renderEnumControl({ key, label }, options, settings) {
  const row = document.createElement('label');
  row.className = 'control-row';
  const current = settings[key] || options[0];
  row.innerHTML = `
    <span>${label}</span>
    <select></select>
  `;
  const select = row.querySelector('select');
  for (const optionValue of options) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    option.selected = optionValue === current;
    select.append(option);
  }
  select.addEventListener('change', () => {
    applyCameraConstraint(key, select.value);
  });
  controlsList.append(row);
}

function renderCameraControls(track) {
  controlsList.innerHTML = '';
  if (!track?.getCapabilities) {
    clearCameraControls('当前浏览器不支持读取摄像头控制能力。');
    return;
  }

  const capabilities = track.getCapabilities();
  const settings = track.getSettings ? track.getSettings() : {};
  let count = 0;

  for (const control of numericControls) {
    const capability = capabilities[control.key];
    if (!supportsNumericControl(capability)) continue;
    renderNumericControl(control, capability, settings);
    count += 1;
  }

  for (const control of enumControls) {
    const options = capabilities[control.key];
    if (!Array.isArray(options) || options.length === 0) continue;
    renderEnumControl(control, options, settings);
    count += 1;
  }

  controlsHint.textContent = count > 0
    ? `当前设备支持 ${count} 个可调项。`
    : '当前设备/浏览器没有暴露缩放、焦距、亮度等硬件调节项。';
}

function applyPreviewSoftwareAdjustments() {
  const normalized = CaptureEffects.normalizeSoftwareAdjustments(softwareAdjustments);
  softwareAdjustments = normalized;
  preview.style.filter = CaptureEffects.cssFilterForAdjustments(normalized);
  preview.style.transform = `scale(${normalized.zoom})`;
  preview.style.transformOrigin = 'center center';
}

function renderSoftwareControls() {
  softwareControlsList.innerHTML = '';
  for (const definition of CaptureEffects.SOFTWARE_CONTROL_DEFS) {
    const row = document.createElement('label');
    row.className = 'control-row';
    const value = softwareAdjustments[definition.key];
    row.innerHTML = `
      <span>${definition.label}</span>
      <input type="range" min="${definition.min}" max="${definition.max}" step="${definition.step}" value="${value}" />
      <output>${value}${definition.unit}</output>
    `;
    const input = row.querySelector('input');
    const output = row.querySelector('output');
    input.addEventListener('input', () => {
      softwareAdjustments[definition.key] = Number(input.value);
      softwareAdjustments = CaptureEffects.normalizeSoftwareAdjustments(softwareAdjustments);
      output.textContent = `${softwareAdjustments[definition.key]}${definition.unit}`;
      applyPreviewSoftwareAdjustments();
    });
    softwareControlsList.append(row);
  }
  applyPreviewSoftwareAdjustments();
}

function resizeAnnotationCanvas() {
  const rect = annotationCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (annotationCanvas.width !== width || annotationCanvas.height !== height) {
    annotationCanvas.width = width;
    annotationCanvas.height = height;
  }
  renderAnnotations();
}

function pointFromPointer(event) {
  const rect = annotationCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

function drawShape(context, shape, width, height) {
  context.save();
  context.strokeStyle = '#ff1f1f';
  context.lineWidth = Math.max(4, Math.round(width * 0.004));
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (shape.type === 'rect' || shape.type === 'circle') {
    const x1 = shape.start.x * width;
    const y1 = shape.start.y * height;
    const x2 = shape.end.x * width;
    const y2 = shape.end.y * height;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const boxWidth = Math.abs(x2 - x1);
    const boxHeight = Math.abs(y2 - y1);
    if (shape.type === 'rect') {
      context.strokeRect(left, top, boxWidth, boxHeight);
    } else {
      context.beginPath();
      context.ellipse(
        left + boxWidth / 2,
        top + boxHeight / 2,
        boxWidth / 2,
        boxHeight / 2,
        0,
        0,
        Math.PI * 2
      );
      context.stroke();
    }
  }
  if (shape.type === 'pen' && shape.points.length > 1) {
    context.beginPath();
    context.moveTo(shape.points[0].x * width, shape.points[0].y * height);
    for (const point of shape.points.slice(1)) {
      context.lineTo(point.x * width, point.y * height);
    }
    context.stroke();
  }
  context.restore();
}

function renderAnnotations() {
  const context = annotationCanvas.getContext('2d');
  context.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  for (const shape of annotations) {
    drawShape(context, shape, annotationCanvas.width, annotationCanvas.height);
  }
  if (activeAnnotation) {
    drawShape(context, activeAnnotation, annotationCanvas.width, annotationCanvas.height);
  }
}

function drawAnnotationsOnCapture(context, width, height) {
  for (const shape of annotations) {
    drawShape(context, shape, width, height);
  }
}

function drawPreviewToCanvas(maxWidth = 320) {
  const sourceWidth = preview.videoWidth || 1920;
  const sourceHeight = preview.videoHeight || 1080;
  const scale = Math.min(1, maxWidth / sourceWidth);
  scratchCanvas.width = Math.max(1, Math.round(sourceWidth * scale));
  scratchCanvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = scratchCanvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(preview, 0, 0, scratchCanvas.width, scratchCanvas.height);
  return context;
}

function measureBrightness() {
  if (!preview.videoWidth) return { exposure: 'unknown', brightness: 0 };
  const context = drawPreviewToCanvas(240);
  const { data } = context.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height);
  let sum = 0;
  for (let index = 0; index < data.length; index += 4) {
    sum += 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
  }
  const brightness = Math.round(sum / (data.length / 4));
  let exposure = 'ok';
  if (brightness >= 230) exposure = 'overexposed';
  if (brightness <= 45) exposure = 'underexposed';
  return { exposure, brightness };
}

function refreshQualityHint() {
  if (!stream || !preview.videoWidth) return;
  lastQuality = measureBrightness();
  if (lastQuality.exposure === 'overexposed') {
    setHint(`画面过曝，亮度 ${lastQuality.brightness}。减少直射光或调暗环境。`, 'warn');
  } else if (lastQuality.exposure === 'underexposed') {
    setHint(`画面过暗，亮度 ${lastQuality.brightness}。增加补光。`, 'warn');
  } else {
    setHint(`画面亮度正常: ${lastQuality.brightness}。`, 'ok');
  }
}

function captureDataUrl() {
  const width = preview.videoWidth;
  const height = preview.videoHeight;
  scratchCanvas.width = width;
  scratchCanvas.height = height;
  const context = scratchCanvas.getContext('2d');
  const adjustments = CaptureEffects.normalizeSoftwareAdjustments(softwareAdjustments);
  const crop = CaptureEffects.computeZoomCrop({
    sourceWidth: width,
    sourceHeight: height,
    zoom: adjustments.zoom,
  });
  context.filter = CaptureEffects.cssFilterForAdjustments(adjustments);
  context.drawImage(
    preview,
    crop.sx,
    crop.sy,
    crop.sWidth,
    crop.sHeight,
    0,
    0,
    width,
    height
  );
  drawAnnotationsOnCapture(context, width, height);
  context.filter = 'none';
  return {
    imageData: scratchCanvas.toDataURL('image/jpeg', 0.92),
    width,
    height,
    softwareAdjustments: adjustments,
    annotationCount: annotations.length,
  };
}

function addRecentCapture(payload, localImageData) {
  const item = document.createElement('li');
  item.className = 'recent-item';
  item.innerHTML = `
    <img src="${localImageData}" alt="刚拍摄的试卷缩略图" />
    <div>
      <strong>${payload.imagePath.split('/').pop()}</strong>
      <button type="button">复制路径</button>
    </div>
  `;
  item.querySelector('button').addEventListener('click', async () => {
    await navigator.clipboard.writeText(payload.imagePath);
  });
  recentList.prepend(item);
  while (recentList.children.length > 10) {
    recentList.lastElementChild.remove();
  }
}

async function capture() {
  if (!stream) {
    setHint('摄像头未开启，不能拍照。', 'error');
    return;
  }
  captureButton.disabled = true;
  try {
    refreshQualityHint();
    const frame = captureDataUrl();
    const response = await fetch('/api/captures', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...frame,
        deviceLabel: currentDeviceLabel,
        quality: {
          ...lastQuality,
          software_adjustments: frame.softwareAdjustments,
          annotation_count: frame.annotationCount,
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '保存失败');
    addRecentCapture(payload, frame.imageData);
    setHint(`已保存: ${payload.imagePath}`, lastQuality.exposure === 'ok' ? 'ok' : 'warn');
  } catch (error) {
    setHint(error.message, 'error');
  } finally {
    captureButton.disabled = false;
  }
}

async function startSelectedCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setHint('当前浏览器不支持摄像头 API。', 'error');
    return;
  }
  try {
    startCameraButton.disabled = true;
    setHint('正在开启摄像头……', 'normal');
    await enumerateVideoDevices();
    const selected = deviceSelect.value || preferredDeviceId();
    await startCamera(selected);
    const preferred = preferredDeviceId();
    if (!selected && preferred && preferred !== deviceSelect.value) {
      await startCamera(preferred);
    }
  } catch (error) {
    startCameraButton.disabled = false;
    stopCameraButton.disabled = true;
    captureButton.disabled = true;
    standbyOverlay.hidden = false;
    setHint(`摄像头启动失败: ${error.message}`, 'error');
  }
}

deviceSelect.addEventListener('change', () => {
  if (!stream) {
    setHint('已选择摄像头。点击“开启摄像头”后生效。', 'normal');
    return;
  }
  startCamera(deviceSelect.value).catch((error) => {
    setHint(`切换摄像头失败: ${error.message}`, 'error');
  });
});

startCameraButton.addEventListener('click', startSelectedCamera);
stopCameraButton.addEventListener('click', stopCamera);
captureButton.addEventListener('click', capture);
resolutionMode.addEventListener('change', () => {
  if (!stream) return;
  startCamera(deviceSelect.value).catch((error) => {
    setHint(`切换分辨率失败: ${error.message}`, 'error');
  });
});

annotationToolbar.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-tool]');
  if (!button) return;
  annotationTool = button.dataset.tool;
  for (const item of annotationToolbar.querySelectorAll('button[data-tool]')) {
    item.classList.toggle('active', item === button);
  }
});

annotationCanvas.addEventListener('pointerdown', (event) => {
  annotationCanvas.setPointerCapture(event.pointerId);
  const point = pointFromPointer(event);
  activeAnnotation = annotationTool === 'pen'
    ? { type: 'pen', points: [point] }
    : { type: annotationTool, start: point, end: point };
  renderAnnotations();
});

annotationCanvas.addEventListener('pointermove', (event) => {
  if (!activeAnnotation) return;
  const point = pointFromPointer(event);
  if (activeAnnotation.type === 'pen') {
    activeAnnotation.points.push(point);
  } else {
    activeAnnotation.end = point;
  }
  renderAnnotations();
});

annotationCanvas.addEventListener('pointerup', () => {
  if (!activeAnnotation) return;
  annotations.push(activeAnnotation);
  activeAnnotation = null;
  renderAnnotations();
});

annotationCanvas.addEventListener('pointercancel', () => {
  activeAnnotation = null;
  renderAnnotations();
});

clearAnnotationsButton.addEventListener('click', () => {
  annotations = [];
  activeAnnotation = null;
  renderAnnotations();
});

openFolderButton.addEventListener('click', async () => {
  await fetch('/api/open-scans', { method: 'POST' });
});

refreshDevicesButton.addEventListener('click', async () => {
  try {
    const found = await enumerateVideoDevices();
    setHint(`已刷新摄像头列表，发现 ${found.length} 个视频设备。`, 'ok');
  } catch (error) {
    setHint(`刷新设备失败: ${error.message}`, 'error');
  }
});

preview.addEventListener('loadedmetadata', refreshQualityHint);
preview.addEventListener('loadedmetadata', updateActualResolution);
window.addEventListener('resize', resizeAnnotationCanvas);
setInterval(refreshQualityHint, 1500);

enumerateVideoDevices().catch(() => {
  setHint('点击“开启摄像头”后，浏览器会请求权限并显示可用设备。', 'normal');
});
renderSoftwareControls();
resizeAnnotationCanvas();
