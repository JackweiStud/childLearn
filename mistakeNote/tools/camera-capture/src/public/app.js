// app.js - 错题拍照台主调度控制文件，协调模块初始化和主事件分发
(function orchestrator() {
  // 当 DOM 树和资源就绪后执行初始化
  window.addEventListener('DOMContentLoaded', async () => {
    UI.log('错题拍照台正在初始化...');

    try {
      // 1. 初始化标注模块 (红色圆、矩形、画笔、橡皮、截图等)
      if (window.AnnotationHandler) {
        window.AnnotationHandler.init();
      }

      // 2. 初始化最近拍摄模块 (双击调用大图、Finder打开目录等)
      if (window.RecentHandler) {
        window.RecentHandler.init();
      }

      // 3. 页面初次载入时，默认触发一次摄像头检测
      if (window.CameraHandler) {
        const firstScan = await window.CameraHandler.detectDevices();
        UI.setStatus('系统准备就绪。默认不打开摄像头，请选择设备后点击"开启摄像头"开始取景。', 'normal');

        // 方案 A：3 秒后自动静默重扫一次，捕获 macOS 异步注册的 iPhone Continuity Camera
        // macOS 上 iPhone 通过 BLE 握手注册到 AVFoundation 通常有 1-3 秒延迟，
        // 首次进页面那一刻经常扫不到，等一会儿再扫就能看到
        setTimeout(async () => {
          const secondScan = await window.CameraHandler.detectDevices({ silent: true });
          const prev = new Set(firstScan.deviceValues || []);
          const added = (secondScan.deviceValues || []).filter(v => !prev.has(v));
          if (added.length > 0) {
            const addedLabels = (secondScan.deviceLabels || [])
              .filter((_, i) => !prev.has(secondScan.deviceValues[i]))
              .join('、');
            UI.log(`后台重扫新发现摄像头：${addedLabels}`);
            UI.showToast(`新检测到摄像头：${addedLabels}`, 'success');
          }
        }, 3000);
      }

      // 4. 事件绑定
      bindEvents();

      // 5. 启动画质/亮度定时评估循环 (每隔1.5秒采样当前图像亮度)
      if (window.CameraHandler) {
        setInterval(window.CameraHandler.checkQualityLoop, 1500);
      }

      UI.log('错题拍照台主调度器启动成功。');
    } catch (err) {
      UI.setStatus(`应用初始化失败: ${err.message}`, 'error');
    }
  });

  // 绑定界面各核心按钮与事件
  function bindEvents() {
    // 开启摄像头取景
    UI.elements.startCameraButton.addEventListener('click', async () => {
      if (window.CameraHandler) {
        await window.CameraHandler.start();
      }
    });

    // 关闭摄像头取景
    UI.elements.stopCameraButton.addEventListener('click', async () => {
      if (window.CameraHandler) {
        await window.CameraHandler.stop();
      }
    });

    // 拍照保存
    UI.elements.captureButton.addEventListener('click', async () => {
      if (window.CameraHandler) {
        await window.CameraHandler.capture();
      }
    });

    // 刷新与重新扫描摄像头列表
    UI.elements.refreshDevicesButton.addEventListener('click', async () => {
      if (window.CameraHandler) {
        // 先停掉可能占用的流
        await window.CameraHandler.stop();
        // 重新扫描
        await window.CameraHandler.detectDevices();
        UI.setStatus('摄像头设备列表刷新成功。', 'ok');
      }
    });

    // 切换分辨率设置（若当前流运行中，自动重启流以应用）
    UI.elements.resolutionMode.addEventListener('change', async () => {
      if (window.CameraHandler && window.CameraHandler.state.currentDeviceType === 'webrtc') {
        UI.log('分辨率已变更，正在重新连接摄像头流以应用新参数...');
        await window.CameraHandler.start();
      }
    });

    // 切换摄像头设备：立即更新分辨率可选状态，若摄像头开着则自动切换流
    UI.elements.deviceSelect.addEventListener('change', async () => {
      if (!window.CameraHandler) return;

      // 无论摄像头是否开启，先同步分辨率选择器的可用状态
      window.CameraHandler.updateResolutionSelectState();

      if (window.CameraHandler.state.currentDeviceType) {
        UI.log('设备已变更，正在切换到新摄像头流...');
        await window.CameraHandler.start();
      } else {
        UI.setStatus('已选择摄像头设备。请点击”开启摄像头”按钮开始预览。', 'normal');
      }
    });

    // 切换 A4 参考框辅助线模式
    if (UI.elements.a4GuideMode && UI.elements.a4Guide) {
      UI.elements.a4GuideMode.addEventListener('change', () => {
        const mode = UI.elements.a4GuideMode.value;
        UI.elements.a4Guide.classList.remove('a4-portrait', 'a4-landscape', 'a4-off');
        if (mode === 'portrait') {
          UI.elements.a4Guide.classList.add('a4-portrait');
        } else if (mode === 'landscape') {
          UI.elements.a4Guide.classList.add('a4-landscape');
        } else if (mode === 'off') {
          UI.elements.a4Guide.classList.add('a4-off');
        }
        UI.log(`A4参考线模式变更为: ${mode}`);
      });
    }

    // 画面旋转
    if (UI.elements.rotate90Button) {
      UI.elements.rotate90Button.addEventListener('click', () => {
        if (window.CameraHandler) window.CameraHandler.rotate90();
      });
    }
    if (UI.elements.resetRotationButton) {
      UI.elements.resetRotationButton.addEventListener('click', () => {
        if (window.CameraHandler) window.CameraHandler.resetRotation();
      });
    }

    // 左侧标注工具栏折叠
    if (UI.elements.toolbarToggleBtn && UI.elements.leftToolbar) {
      UI.elements.toolbarToggleBtn.addEventListener('click', () => {
        const isCollapsed = UI.elements.leftToolbar.classList.toggle('collapsed');
        UI.log(isCollapsed ? '标注工具栏已收起' : '标注工具栏已展开');
      });
    }

    // 右侧设置栏折叠
    if (UI.elements.rightToolbarToggleBtn && UI.elements.rightToolbar) {
      UI.elements.rightToolbarToggleBtn.addEventListener('click', () => {
        const isCollapsed = UI.elements.rightToolbar.classList.toggle('collapsed');
        UI.log(isCollapsed ? '设置栏已收起' : '设置栏已展开');
      });
    }

    // 全屏切换功能
    if (UI.elements.fullscreenToggleBtn) {
      UI.elements.fullscreenToggleBtn.addEventListener('click', () => {
        const container = UI.elements.previewWrap;
        if (!container) return;
        if (!document.fullscreenElement) {
          container.requestFullscreen().catch(err => {
            UI.log(`全屏失败: ${err.message}`, 'error');
            UI.showToast(`全屏失败: ${err.message}`, 'error');
          });
        } else {
          document.exitFullscreen();
        }
      });
    }

    // 全屏状态改变时重绘 canvas 并校准像素尺寸
    // requestAnimationFrame 等全屏 reflow 完成后再取尺寸，避免时序竞争
    document.addEventListener('fullscreenchange', () => {
      if (window.AnnotationHandler) {
        requestAnimationFrame(() => window.AnnotationHandler.resizeCanvas());
      }
    });

    // 画面调节卡片折叠
    if (UI.elements.cameraControlsToggle && UI.elements.cameraControls) {
      UI.elements.cameraControlsToggle.addEventListener('click', () => {
        const isCollapsed = UI.elements.cameraControls.classList.toggle('collapsed');
        UI.elements.cameraControlsToggle.classList.toggle('active', !isCollapsed);
      });
    }

    // 最近拍摄卡片折叠
    if (UI.elements.recentCapturesToggle && UI.elements.recentCapturesBody) {
      UI.elements.recentCapturesToggle.addEventListener('click', () => {
        const isCollapsed = UI.elements.recentCapturesBody.classList.toggle('collapsed');
        UI.elements.recentCapturesToggle.classList.toggle('active', !isCollapsed);
      });
    }

    // 右栏高度跟随主区域 center-workspace 总高度（含顶部控制条 + 视频区）
    // 内部 recent-scroll 自动滚动，避免长列表把页面拉到天上
    const recentPanelEl = document.querySelector('.recent-panel');
    const centerWorkspaceEl = document.querySelector('.center-workspace');
    if (centerWorkspaceEl && recentPanelEl && 'ResizeObserver' in window) {
      const syncHeight = () => {
        // 全屏时 preview-wrap 是 100vh，不要把右栏也撑到 100vh
        if (document.fullscreenElement === UI.elements.previewWrap) return;
        recentPanelEl.style.height = centerWorkspaceEl.offsetHeight + 'px';
      };
      new ResizeObserver(syncHeight).observe(centerWorkspaceEl);
      syncHeight();
    }

    // 键盘快捷键：⌘S 拍照、⌘Z 撤销、ESC 清空标注
    document.addEventListener('keydown', (e) => {
      // 焦点在输入框时不拦截
      if (e.target.matches('input, select, textarea')) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!UI.elements.captureButton.disabled) {
          UI.elements.captureButton.click();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        UI.elements.undoButton.click();
        return;
      }
      if (e.key === 'Escape') {
        UI.elements.clearAnnotationsButton.click();
      }
    });
  }
})();
