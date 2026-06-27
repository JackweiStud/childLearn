// ui.js - 管理基础 DOM 引用与诊断日志面板
(function exposeUI(root) {
  const elements = {
    deviceSelect: document.getElementById('deviceSelect'),
    resolutionMode: document.getElementById('resolutionMode'),
    preview: document.getElementById('preview'),
    nativePreview: document.getElementById('nativePreview'),
    annotationCanvas: document.getElementById('annotationCanvas'),
    startCameraButton: document.getElementById('startCameraButton'),
    stopCameraButton: document.getElementById('stopCameraButton'),
    refreshDevicesButton: document.getElementById('refreshDevicesButton'),
    captureButton: document.getElementById('captureButton'),
    openFolderButton: document.getElementById('openFolderButton'),
    qualityHint: document.getElementById('qualityHint'),
    actualResolution: document.getElementById('actualResolution'),
    controlsList: document.getElementById('controlsList'),
    softwareControlsList: document.getElementById('softwareControlsList'),
    browserDevicesList: document.getElementById('browserDevicesList'),
    systemDevicesList: document.getElementById('systemDevicesList'),
    recentList: document.getElementById('recentList'),
    scratchCanvas: document.getElementById('scratchCanvas'),
    standbyOverlay: document.getElementById('standbyOverlay'),
    annotationToolbar: document.getElementById('annotationToolbar'),
    clearAnnotationsButton: document.getElementById('clearAnnotationsButton'),
    
    // 标注、调节和日志新引用
    undoButton: document.getElementById('undoButton'),
    colorPicker: document.getElementById('colorPicker'),
    toggleLogButton: document.getElementById('toggleLogButton'),
    logDrawer: document.querySelector('.log-drawer'),
    logsConsole: document.getElementById('logsConsole'),
    cameraControlsPanel: document.getElementById('cameraControls'),
    hardwareControlsWrapper: document.getElementById('hardwareControlsWrapper'),
    softwareControlsWrapper: document.getElementById('softwareControlsWrapper'),
    unsupportedControlsHint: document.getElementById('unsupportedControlsHint'),
    presetSubject: document.getElementById('presetSubject'),
    presetDifficulty: document.getElementById('presetDifficulty'),
    presetNotes: document.getElementById('presetNotes'),
    shutterFlash: document.getElementById('shutterFlash'),
    toastContainer: document.getElementById('toastContainer'),
    a4GuideMode: document.getElementById('a4GuideMode'),
    a4Guide: document.getElementById('a4Guide'),
    cropActionToolbar: document.getElementById('cropActionToolbar'),
    cropConfirmButton: document.getElementById('cropConfirmButton'),
    cropCancelButton: document.getElementById('cropCancelButton'),
  };

  // 控制台日志功能
  function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const line = `[${time}] [${type.toUpperCase()}] ${message}\n`;
    if (elements.logsConsole) {
      elements.logsConsole.textContent += line;
      elements.logsConsole.scrollTop = elements.logsConsole.scrollHeight;
    }
  }

  // 更新当前状态和提示语
  function setStatus(message, tone = 'normal') {
    if (elements.qualityHint) {
      elements.qualityHint.textContent = message;
      elements.qualityHint.dataset.tone = tone;
    }
    log(message, tone === 'error' ? 'error' : tone === 'warn' ? 'warn' : 'info');
  }

  // 显示悬浮 Toast 消息
  function showToast(message, type = 'success') {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    
    // 成功/失败图标
    const iconSvg = type === 'success' 
      ? `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 7L6 8.5L9.5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 4.5L9.5 9.5M9.5 4.5L4.5 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    elements.toastContainer.appendChild(toast);
    
    // 播放动画完毕后自动销毁
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }

  // 绑定折叠底栏日志事件
  if (elements.toggleLogButton && elements.logDrawer) {
    elements.toggleLogButton.addEventListener('click', () => {
      const isCollapsed = elements.logDrawer.classList.toggle('collapsed');
      const indicator = elements.toggleLogButton.querySelector('.drawer-indicator');
      if (indicator) {
        indicator.textContent = isCollapsed ? '▲ 展开' : '▼ 收起';
      }
    });
  }

  root.UI = {
    elements,
    log,
    setStatus,
    showToast
  };
})(window);
