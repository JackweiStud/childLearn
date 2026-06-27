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
    setStatus
  };
})(window);
