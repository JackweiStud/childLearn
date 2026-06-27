// camera-handler.js - 统一管理标准 WebRTC 摄像头流与 native (ffmpeg/AVFoundation) 预览通道
(function exposeCameraHandler(root) {
  // 相机核心状态
  const state = {
    stream: null,
    activeTrack: null,
    currentDeviceType: null,      // 'webrtc' 或 'native'
    currentDeviceId: '',          // WebRTC deviceId 或 native deviceIndex
    currentDeviceLabel: '',       // 摄像头设备名称
    nativeSessionId: '',          // native 预览会话 UUID
    nativeFrameLoading: false,
    nativeRefreshTimer: null,
    nativeObjectUrl: '',
    
    // 缓存最新帧质量评估数据
    lastQuality: { exposure: 'unknown', brightness: 0 }
  };

  // 设备检测及列表填充
  async function detectDevices() {
    UI.log('正在检测并刷新摄像头设备列表...');
    try {
      // 1. 获取系统诊断摄像头 (AVFoundation)
      let systemDevices = [];
      try {
        const response = await fetch('/api/system-cameras');
        if (response.ok) {
          const sysPayload = await response.json();
          systemDevices = sysPayload.devices || [];
          
          // 更新底部系统日志
          UI.elements.systemDevicesList.innerHTML = '';
          if (systemDevices.length === 0) {
            UI.elements.systemDevicesList.innerHTML = '<li>系统未发现可用物理摄像头</li>';
          } else {
            systemDevices.forEach(d => {
              const li = document.createElement('li');
              li.textContent = `[索引 ${d.index}] ${d.label}`;
              UI.elements.systemDevicesList.appendChild(li);
            });
          }
        }
      } catch (err) {
        UI.log(`获取系统底层摄像头失败: ${err.message}`, 'warn');
      }

      // 2. 获取浏览器摄像头 (WebRTC)
      let browserDevices = [];
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        // 请求一次权限以能够获取真实标签
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
          if (tempStream) {
            tempStream.getTracks().forEach(t => t.stop());
          }
        } catch(e) {}

        const all = await navigator.mediaDevices.enumerateDevices();
        browserDevices = all.filter(d => d.kind === 'videoinput');
        
        // 更新底部浏览器设备日志
        UI.elements.browserDevicesList.innerHTML = '';
        if (browserDevices.length === 0) {
          UI.elements.browserDevicesList.innerHTML = '<li>浏览器未授权或未发现摄像头</li>';
        } else {
          browserDevices.forEach((d, idx) => {
            const li = document.createElement('li');
            li.textContent = d.label || `浏览器摄像头 ${idx + 1}`;
            UI.elements.browserDevicesList.appendChild(li);
          });
        }
      }

      // 3. 统一归并在下拉选择框中
      UI.elements.deviceSelect.innerHTML = '';
      
      // 先添加浏览器常规 WebRTC 设备
      browserDevices.forEach((d, idx) => {
        const opt = document.createElement('option');
        opt.value = `webrtc:${d.deviceId}`;
        opt.textContent = d.label || `摄像头 ${idx + 1} (需点击开启授权)`;
        opt.dataset.type = 'webrtc';
        opt.dataset.label = d.label || `摄像头 ${idx + 1}`;
        UI.elements.deviceSelect.appendChild(opt);
      });

      // 再追加系统层有但浏览器 WebRTC 没有暴露的设备
      // 注意：iPhone Continuity Camera 通过 WebRTC 比 ffmpeg 更稳定，
      // 若已在浏览器列表里就不再重复追加 native 通道，避免用户选错
      systemDevices.forEach(sys => {
        const sysLower = sys.label.toLowerCase();
        const existsInBrowser = browserDevices.some(b => {
          if (!b.label) return false;
          const bLower = b.label.toLowerCase();
          // 双向包含检查，避免"Jack's iPhone" vs "FaceTime HD (Jack's iPhone)"之类的漏判
          return bLower.includes(sysLower) || sysLower.includes(bLower);
        });

        if (!existsInBrowser) {
          const opt = document.createElement('option');
          opt.value = `native:${sys.index}`;
          opt.textContent = `[系统原生] ${sys.label}`;
          opt.dataset.type = 'native';
          opt.dataset.index = sys.index;
          opt.dataset.label = sys.label;
          UI.elements.deviceSelect.appendChild(opt);
        }
      });

      if (UI.elements.deviceSelect.options.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '无可用摄像头';
        UI.elements.deviceSelect.appendChild(opt);
        
        UI.setStatus('未检测到任何摄像头设备。', 'warn');
        UI.log('【设备发现提示】未找到任何视频设备。如果您想使用 iPhone 摄像头 (Continuity Camera)，请注意：\n1. 手机需处于锁屏、黑屏状态，且横向放置、保持静止（例如放在支架上）。\n2. 若仍不显示，请在 Mac 上打开 FaceTime 或“照片亭(Photo Booth)”应用，在其视频菜单中选中您的 iPhone 激活连接，然后回到此页面点击“刷新设备”。', 'warn');
      } else {
        // 默认选中策略：如果有外接 USB camera，优先选中；如果有 iPhone 且当前是 native，也作为后备
        let bestIndex = 0;
        for (let i = 0; i < UI.elements.deviceSelect.options.length; i++) {
          const opt = UI.elements.deviceSelect.options[i];
          if (/usb\s*camera/i.test(opt.textContent)) {
            bestIndex = i;
            break;
          }
        }
        UI.elements.deviceSelect.selectedIndex = bestIndex;
        
        // 提示信息
        const hasUnauthorised = browserDevices.some(d => !d.label);
        if (hasUnauthorised) {
          UI.setStatus('检测到未授权设备。请点击“开启摄像头”允许浏览器获取真实名称。', 'normal');
        }
      }
      
      UI.log(`已统一摄像头列表：共计 ${UI.elements.deviceSelect.options.length} 个选择`);
      // 根据默认选中设备立即同步分辨率选择器状态
      updateResolutionSelectState();
    } catch (err) {
      UI.setStatus(`设备检测异常: ${err.message}`, 'error');
    }
  }

  // 根据当前下拉选中设备类型，更新分辨率选择器的启用/禁用状态
  // native 通道（ffmpeg）不支持分辨率指定，WebRTC 通道支持
  function updateResolutionSelectState() {
    const selectedOption = UI.elements.deviceSelect.selectedOptions[0];
    if (!selectedOption || !selectedOption.value) {
      UI.elements.resolutionMode.disabled = false;
      UI.elements.resolutionMode.title = '';
      return;
    }
    const isNative = selectedOption.value.startsWith('native:');
    UI.elements.resolutionMode.disabled = isNative;
    UI.elements.resolutionMode.title = isNative
      ? '当前设备通过系统原生通道(ffmpeg)连接，不支持分辨率指定'
      : '';
  }

  // 计算理想分辨率参数
  function getResolutionConstraints() {
    const val = UI.elements.resolutionMode.value;
    if (val === '720p') return { width: { ideal: 1280 }, height: { ideal: 720 } };
    if (val === '1080p') return { width: { ideal: 1920 }, height: { ideal: 1080 } };
    return { width: { ideal: 3840 }, height: { ideal: 2160 } }; // 4K 优先
  }

  // 开启摄像头
  async function start() {
    // 先干净地关闭旧流
    await stop();

    const selectedOption = UI.elements.deviceSelect.selectedOptions[0];
    if (!selectedOption || !selectedOption.value) {
      UI.setStatus('请先选择可用的摄像头', 'warn');
      return;
    }

    const value = selectedOption.value;
    state.currentDeviceLabel = selectedOption.dataset.label || 'Unknown Camera';

    if (value.startsWith('webrtc:')) {
      state.currentDeviceType = 'webrtc';
      state.currentDeviceId = value.replace('webrtc:', '');
      await startWebRTC(state.currentDeviceId);
    } else if (value.startsWith('native:')) {
      state.currentDeviceType = 'native';
      state.currentDeviceId = value.replace('native:', '');
      await startNativePreview(Number(state.currentDeviceId));
    }
  }

  // 1. 开启标准 WebRTC 通道
  async function startWebRTC(deviceId) {
    UI.setStatus(`正在通过浏览器 WebRTC 连接摄像头: ${state.currentDeviceLabel}...`);
    try {
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          ...getResolutionConstraints()
        },
        audio: false
      };

      state.stream = await navigator.mediaDevices.getUserMedia(constraints);
      UI.elements.preview.srcObject = state.stream;
      
      const [track] = state.stream.getVideoTracks();
      state.activeTrack = track;
      
      // 显示 WebRTC 容器，隐藏 native 容器
      UI.elements.preview.hidden = false;
      UI.elements.nativePreview.hidden = true;
      UI.elements.standbyOverlay.hidden = true;

      // 启用按钮状态
      UI.elements.startCameraButton.disabled = true;
      UI.elements.stopCameraButton.disabled = false;
      UI.elements.captureButton.disabled = false;
      UI.elements.resolutionMode.disabled = false; // 启用分辨率选择

      // 调整画布尺寸
      if (window.AnnotationHandler) {
        window.AnnotationHandler.render();
      }

      // 更新实际分辨率并动态应用画面控制
      UI.elements.preview.onloadedmetadata = () => {
        updateActualResolution();
        renderAdjustmentPanels(track);
      };

      UI.setStatus(`已开启浏览器常规预览: ${state.currentDeviceLabel}`, 'ok');
    } catch (err) {
      UI.setStatus(`WebRTC 启动失败: ${err.message}`, 'error');
      await stop();
    }
  }

  // 2. 开启系统原生 (ffmpeg) 预览通道
  async function startNativePreview(deviceIndex) {
    UI.setStatus(`正在启动系统底层 (ffmpeg) 取景会话: ${state.currentDeviceLabel}...`);
    try {
      // 禁用分辨率选择，原生由 ffmpeg 做定额预览
      UI.elements.resolutionMode.disabled = true;

      const response = await fetch('/api/native-preview/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          deviceIndex,
          deviceLabel: state.currentDeviceLabel
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '后端会话创建失败');

      state.nativeSessionId = data.sessionId;
      
      // 显示 native 预览图像，隐藏标准 WebRTC
      UI.elements.preview.hidden = true;
      UI.elements.nativePreview.hidden = false;
      UI.elements.standbyOverlay.hidden = true;

      UI.elements.startCameraButton.disabled = true;
      UI.elements.stopCameraButton.disabled = false;
      UI.elements.captureButton.disabled = false;

      // 定期拉取最新帧图片
      state.nativeRefreshTimer = setInterval(refreshNativeFrame, 200);

      // 渲染画面调节控制 (Native 不支持硬件调节，直接显示软件调节面板)
      renderAdjustmentPanels(null);

      UI.elements.nativePreview.onload = () => {
        updateActualResolution();
      };

      UI.setStatus(`已开启系统原生取景: ${state.currentDeviceLabel}`, 'ok');
    } catch (err) {
      UI.setStatus(`原生取景开启失败: ${err.message}`, 'error');
      await stop();
    }
  }

  // 停止取景
  async function stop() {
    UI.log('正在关闭当前摄像头流...');
    
    // 停止 WebRTC 流
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
    }
    state.stream = null;
    state.activeTrack = null;
    UI.elements.preview.srcObject = null;
    UI.elements.preview.hidden = false;

    // 停止原生预览轮询
    if (state.nativeRefreshTimer) {
      clearInterval(state.nativeRefreshTimer);
      state.nativeRefreshTimer = null;
    }
    if (state.nativeObjectUrl) {
      URL.revokeObjectURL(state.nativeObjectUrl);
      state.nativeObjectUrl = '';
    }
    UI.elements.nativePreview.removeAttribute('src');
    UI.elements.nativePreview.hidden = true;

    // 通知后端释放 ffmpeg 会话
    if (state.nativeSessionId) {
      const sessId = state.nativeSessionId;
      state.nativeSessionId = '';
      fetch('/api/native-preview/stop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: sessId })
      }).catch(() => {});
    }

    state.currentDeviceType = null;
    state.currentDeviceId = '';
    state.lastQuality = { exposure: 'unknown', brightness: 0 };

    // 恢复按钮状态
    UI.elements.startCameraButton.disabled = false;
    UI.elements.stopCameraButton.disabled = true;
    UI.elements.captureButton.disabled = true;
    UI.elements.standbyOverlay.hidden = false;
    UI.elements.actualResolution.textContent = '实际分辨率: --';
    
    // 清空调节面板并显示不支持
    disableAdjustmentPanels();

    UI.setStatus('摄像头已关闭。请点击“开启摄像头”开始使用。', 'normal');
  }

  // 轮询获取原生预览帧
  async function refreshNativeFrame() {
    if (state.currentDeviceType !== 'native' || !state.nativeSessionId || state.nativeFrameLoading) return;
    state.nativeFrameLoading = true;
    try {
      const res = await fetch(`/api/native-preview/frame?sessionId=${encodeURIComponent(state.nativeSessionId)}&t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const blob = await res.blob();
      if (state.nativeObjectUrl) {
        URL.revokeObjectURL(state.nativeObjectUrl);
      }
      state.nativeObjectUrl = URL.createObjectURL(blob);
      UI.elements.nativePreview.src = state.nativeObjectUrl;
    } catch (e) {
      // 容错忽略，等待下一轮轮询
    } finally {
      state.nativeFrameLoading = false;
    }
  }

  // 更新分辨率显示并动态调整取景框的宽高比以保持标注 1:1 精确对齐
  function updateActualResolution() {
    let w = 0, h = 0;
    if (state.currentDeviceType === 'webrtc' && state.activeTrack) {
      const s = state.activeTrack.getSettings ? state.activeTrack.getSettings() : {};
      w = s.width || UI.elements.preview.videoWidth || 0;
      h = s.height || UI.elements.preview.videoHeight || 0;
      UI.elements.actualResolution.textContent = w && h ? `实际分辨率: ${w} × ${h}` : '实际分辨率: 读取中';
    } else if (state.currentDeviceType === 'native') {
      w = UI.elements.nativePreview.naturalWidth || 0;
      h = UI.elements.nativePreview.naturalHeight || 0;
      UI.elements.actualResolution.textContent = w && h ? `实际分辨率: ${w} × ${h} (原生取景)` : '实际分辨率: 正在读取';
    } else {
      UI.elements.actualResolution.textContent = '实际分辨率: --';
    }

    if (w > 0 && h > 0) {
      const wrap = document.querySelector('.preview-wrap');
      if (wrap) {
        wrap.style.aspectRatio = `${w} / ${h}`;
        if (window.AnnotationHandler) {
          window.AnnotationHandler.resizeCanvas();
        }
      }
    }
  }

  // 画面画质/亮度实时检测
  function measureBrightness() {
    const canvas = UI.elements.scratchCanvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    let sourceElement = null;
    let sw = 0, sh = 0;

    if (state.currentDeviceType === 'webrtc' && UI.elements.preview.videoWidth) {
      sourceElement = UI.elements.preview;
      sw = sourceElement.videoWidth;
      sh = sourceElement.videoHeight;
    } else if (state.currentDeviceType === 'native' && UI.elements.nativePreview.naturalWidth) {
      sourceElement = UI.elements.nativePreview;
      sw = sourceElement.naturalWidth;
      sh = sourceElement.naturalHeight;
    }

    if (!sourceElement || sw <= 0 || sh <= 0) {
      return { exposure: 'unknown', brightness: 0 };
    }

    // 缩小便于高性能计算
    const evalSize = 120;
    canvas.width = evalSize;
    canvas.height = Math.round(evalSize * (sh / sw));
    
    ctx.drawImage(sourceElement, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      // 常用亮度转换公式
      sum += 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
    }
    const brightness = Math.round(sum / (data.length / 4));
    let exposure = 'ok';
    if (brightness >= 225) exposure = 'overexposed'; // 过曝
    else if (brightness <= 48) exposure = 'underexposed'; // 过暗

    return { exposure, brightness };
  }

  // 每秒定时检测亮度质量并提示
  function checkQualityLoop() {
    if (!state.currentDeviceType) return;
    
    const quality = measureBrightness();
    state.lastQuality = quality;

    if (quality.exposure === 'overexposed') {
      UI.setStatus(`画面过曝 (亮度值 ${quality.brightness})，请调暗灯光或调整试卷位置。`, 'warn');
    } else if (quality.exposure === 'underexposed') {
      UI.setStatus(`画面太暗 (亮度值 ${quality.brightness})，建议打开补光灯。`, 'warn');
    } else if (quality.exposure === 'ok') {
      UI.setStatus(`画面亮度良好 (当前亮度值 ${quality.brightness})。`, 'ok');
    }
  }

  // 画面调节面板的动态逻辑
  const numericControls = [
    { key: 'zoom', label: '缩放' },
    { key: 'brightness', label: '亮度' },
    { key: 'contrast', label: '对比度' },
    { key: 'saturation', label: '饱和度' },
    { key: 'sharpness', label: '锐度' },
    { key: 'exposureCompensation', label: '曝光补偿' },
    { key: 'focusDistance', label: '焦距/对焦' },
    { key: 'colorTemperature', label: '色温' }
  ];
  const enumControls = [
    { key: 'focusMode', label: '对焦模式' },
    { key: 'exposureMode', label: '曝光模式' },
    { key: 'whiteBalanceMode', label: '白平衡模式' }
  ];

  // 禁用调节面板显示
  function disableAdjustmentPanels() {
    UI.elements.cameraControlsPanel.classList.add('disabled');
    UI.elements.hardwareControlsWrapper.hidden = true;
    UI.elements.softwareControlsWrapper.hidden = true;
    UI.elements.unsupportedControlsHint.hidden = false;
  }

  // 获取硬件支持的初始值
  function getHardwareVal(settings, capability, key) {
    if (typeof settings[key] === 'number') return settings[key];
    if (capability && typeof capability.min === 'number' && typeof capability.max === 'number') {
      return (capability.min + capability.max) / 2;
    }
    return 0;
  }

  // 应用 WebRTC 硬件参数
  async function applyHardwareAdjustment(key, value) {
    if (state.currentDeviceType !== 'webrtc' || !state.activeTrack) return;
    try {
      await state.activeTrack.applyConstraints({
        advanced: [{ [key]: value }]
      });
      UI.log(`已应用硬件参数: ${key} = ${value}`);
    } catch (err) {
      UI.log(`硬件调节 ${key} 失败: ${err.message}`, 'warn');
    }
  }

  // 渲染画质控制项
  function renderAdjustmentPanels(track) {
    UI.elements.cameraControlsPanel.classList.remove('disabled');
    
    let hasHardware = false;
    
    // 1. 如果有 WebRTC 轨道且支持 getCapabilities
    if (track && track.getCapabilities) {
      const caps = track.getCapabilities();
      const settings = track.getSettings ? track.getSettings() : {};
      
      UI.elements.controlsList.innerHTML = '';
      let hwCount = 0;

      // 渲染数值控制
      numericControls.forEach(ctrl => {
        const cap = caps[ctrl.key];
        if (cap && typeof cap.min === 'number' && typeof cap.max === 'number' && cap.min !== cap.max) {
          const val = getHardwareVal(settings, cap, ctrl.key);
          const step = cap.step || 1;
          
          const row = document.createElement('label');
          row.className = 'control-row';
          row.innerHTML = `
            <span>${ctrl.label}</span>
            <input type="range" min="${cap.min}" max="${cap.max}" step="${step}" value="${val}" />
            <output>${val}</output>
          `;
          
          const input = row.querySelector('input');
          const output = row.querySelector('output');
          input.addEventListener('input', () => {
            output.textContent = input.value;
          });
          input.addEventListener('change', () => {
            applyHardwareAdjustment(ctrl.key, Number(input.value));
          });

          UI.elements.controlsList.appendChild(row);
          hwCount++;
        }
      });

      // 渲染枚举选择控制
      enumControls.forEach(ctrl => {
        const opts = caps[ctrl.key];
        if (Array.isArray(opts) && opts.length > 0) {
          const curVal = settings[ctrl.key] || opts[0];
          
          const row = document.createElement('label');
          row.className = 'control-row';
          row.innerHTML = `
            <span>${ctrl.label}</span>
            <select class="styled-select"></select>
          `;
          
          const select = row.querySelector('select');
          opts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o;
            opt.textContent = o;
            opt.selected = (o === curVal);
            select.appendChild(opt);
          });

          select.addEventListener('change', () => {
            applyHardwareAdjustment(ctrl.key, select.value);
          });

          UI.elements.controlsList.appendChild(row);
          hwCount++;
        }
      });

      if (hwCount > 0) {
        hasHardware = true;
        UI.elements.hardwareControlsWrapper.hidden = false;
        UI.elements.unsupportedControlsHint.hidden = true;
        UI.elements.softwareControlsWrapper.hidden = true; // 硬件支持时优先用硬件调节，屏蔽软件调节以防冲突
        UI.log(`检测到 ${hwCount} 个可调硬件参数，已激活硬件画面调节`);
      }
    }

    // 2. 如果不支持硬件参数（或者当前是原生预览），加载软件调节面板作为兜底
    if (!hasHardware) {
      UI.elements.hardwareControlsWrapper.hidden = true;
      UI.elements.softwareControlsWrapper.hidden = false;
      UI.elements.unsupportedControlsHint.hidden = true;
      renderSoftwareControlsList();
      UI.log('使用软件层级画面过滤参数调节 (CSS / Canvas Fallback)');
    }
  }

  // 渲染软件滤镜调节组件
  let softwareAdjustments = CaptureEffects.normalizeSoftwareAdjustments();

  function renderSoftwareControlsList() {
    UI.elements.softwareControlsList.innerHTML = '';
    
    CaptureEffects.SOFTWARE_CONTROL_DEFS.forEach(def => {
      const val = softwareAdjustments[def.key];
      const row = document.createElement('label');
      row.className = 'control-row';
      row.innerHTML = `
        <span>${def.label}</span>
        <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${val}" />
        <output>${val}${def.unit}</output>
      `;

      const input = row.querySelector('input');
      const output = row.querySelector('output');
      input.addEventListener('input', () => {
        softwareAdjustments[def.key] = Number(input.value);
        softwareAdjustments = CaptureEffects.normalizeSoftwareAdjustments(softwareAdjustments);
        output.textContent = `${softwareAdjustments[def.key]}${def.unit}`;
        
        // 实时修改预览画面滤镜
        applySoftwareFiltersToPreview();
      });

      UI.elements.softwareControlsList.appendChild(row);
    });

    applySoftwareFiltersToPreview();
  }

  // 应用软件 CSS filter/transform 滤镜于画面预览上
  function applySoftwareFiltersToPreview() {
    const filters = CaptureEffects.cssFilterForAdjustments(softwareAdjustments);
    const scale = softwareAdjustments.zoom;

    const targetPreview = (state.currentDeviceType === 'native') ? UI.elements.nativePreview : UI.elements.preview;
    
    // 应用效果
    targetPreview.style.filter = filters;
    targetPreview.style.transform = `scale(${scale})`;
    targetPreview.style.transformOrigin = 'center center';
  }

  // 拍摄当前画面生成大图数据
  function generateCaptureFrame() {
    let source = null;
    let sw = 0, sh = 0;

    if (state.currentDeviceType === 'webrtc') {
      source = UI.elements.preview;
      sw = source.videoWidth;
      sh = source.videoHeight;
    } else {
      source = UI.elements.nativePreview;
      sw = source.naturalWidth;
      sh = source.naturalHeight;
    }

    if (!source || sw <= 0 || sh <= 0) {
      throw new Error('摄像头画面尚未准备好，无法拍照');
    }

    const canvas = UI.elements.scratchCanvas;
    const ctx = canvas.getContext('2d');

    // 软件参数获取
    const adj = CaptureEffects.normalizeSoftwareAdjustments(softwareAdjustments);
    const hasCropBox = window.AnnotationHandler && window.AnnotationHandler.state.cropBox;

    let targetWidth = sw;
    let targetHeight = sh;
    let sx = 0, sy = 0, sWidth = sw, sHeight = sh;

    // 1. 如果用户划定了手动裁剪截图区域，执行裁剪剪切
    if (hasCropBox) {
      const box = window.AnnotationHandler.state.cropBox;
      const x1 = Math.min(box.start.x, box.end.x);
      const y1 = Math.min(box.start.y, box.end.y);
      const boxW = Math.abs(box.end.x - box.start.x);
      const boxH = Math.abs(box.end.y - box.start.y);

      sx = Math.round(x1 * sw);
      sy = Math.round(y1 * sh);
      sWidth = Math.round(boxW * sw);
      sHeight = Math.round(boxH * sh);
      
      targetWidth = sWidth;
      targetHeight = sHeight;
    } else {
      // 2. 否则按常规软件缩放 (中心裁剪) 计算
      const crop = CaptureEffects.computeZoomCrop({
        sourceWidth: sw,
        sourceHeight: sh,
        zoom: adj.zoom
      });
      sx = crop.sx;
      sy = crop.sy;
      sWidth = crop.sWidth;
      sHeight = crop.sHeight;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // 应用软件图像处理滤镜效果
    ctx.filter = CaptureEffects.cssFilterForAdjustments(adj);

    // 绘制主体图像
    ctx.drawImage(
      source,
      sx, sy, sWidth, sHeight,  // 源取景范围
      0, 0, targetWidth, targetHeight // 目标画布大小
    );

    ctx.filter = 'none';

    // 3. 将绘制好的红色标注图层覆盖其上（需要保证坐标转换正确）
    if (window.AnnotationHandler) {
      if (!hasCropBox) {
        window.AnnotationHandler.drawOnCapture(ctx, targetWidth, targetHeight);
      } else {
        // 创建一个临时全尺寸画布绘制所有标注
        const annoCanvas = document.createElement('canvas');
        annoCanvas.width = sw;
        annoCanvas.height = sh;
        const annoCtx = annoCanvas.getContext('2d');
        window.AnnotationHandler.drawOnCapture(annoCtx, sw, sh);

        // 将标注画布的对应区域裁剪并贴到目标画布上
        ctx.drawImage(
          annoCanvas,
          sx, sy, sWidth, sHeight,  // 裁剪源区域
          0, 0, targetWidth, targetHeight // 目标贴图区域
        );
      }
    }

    return {
      imageData: canvas.toDataURL('image/jpeg', 0.92),
      width: targetWidth,
      height: targetHeight,
      softwareAdjustments: adj,
      annotationCount: window.AnnotationHandler ? window.AnnotationHandler.state.shapes.length : 0,
      isCropped: !!hasCropBox
    };
  }

  // 拍照保存
  async function capture() {
    UI.elements.captureButton.disabled = true;
    UI.setStatus('正在处理并保存试卷快照...', 'normal');
    
    try {
      // 生成最终待保存的 JPG 像素
      const frame = generateCaptureFrame();
      
      // 保存到本地
      const response = await fetch('/api/captures', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          imageData: frame.imageData,
          width: frame.width,
          height: frame.height,
          deviceLabel: state.currentDeviceLabel,
          quality: {
            exposure: state.lastQuality.exposure,
            brightness: state.lastQuality.brightness,
            capture_mode: state.currentDeviceType === 'webrtc' ? 'webrtc-stream' : 'native-ffmpeg-preview',
            is_cropped: frame.isCropped,
            annotation_count: frame.annotationCount,
            software_adjustments: frame.softwareAdjustments
          }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存文件时后端报错');

      // 添加到最近列表
      if (window.RecentHandler) {
        window.RecentHandler.addRecentCapture(data, frame.imageData);
      }

      // 清除截图选区以防阻碍下次拍照
      if (window.AnnotationHandler && window.AnnotationHandler.state.cropBox) {
        window.AnnotationHandler.state.cropBox = null;
        window.AnnotationHandler.render();
      }

      UI.setStatus(`已成功拍照并保存: ${data.imagePath}`, 'ok');
    } catch (err) {
      UI.setStatus(`拍照失败: ${err.message}`, 'error');
    } finally {
      UI.elements.captureButton.disabled = false;
    }
  }

  // 暴露的接口
  root.CameraHandler = {
    state,
    detectDevices,
    start,
    stop,
    capture,
    checkQualityLoop,
    updateResolutionSelectState
  };
})(window);
