// annotation-handler.js - 管理画布标注、画笔颜色、撤销、擦除与区域截图功能
(function exposeAnnotationHandler(root) {
  // 标注状态管理
  const state = {
    currentTool: 'rect',     // rect, circle, pen, eraser, crop, text
    currentColor: '#ff1f1f',  // 默认红笔
    currentFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    currentFontSize: 24,     // 文字字号（像素，相对于显示区域高度，提交时归一化）
    shapes: [],              // 存储所有已画好的标注图形
    undoHistory: [],         // 撤销快照栈，每步保存 shapes 的浅拷贝，最多 10 步
    activeShape: null,       // 正在画的图形 (指针未抬起)
    cropBox: null,           // 裁剪截图区域（归一化坐标：{start: {x,y}, end: {x,y}}）
    eraserWidth: 0.03,       // 橡皮擦宽度（归一化百分比）
    dragHandle: null,        // 当前正在拖拽的控制点或移动标志
    dragStartPoint: null,    // 拖拽起始点归一化坐标
    dragStartBox: null,      // 拖拽起始时裁剪框的归一化范围
    isDrawingCrop: false     // 是否正在从头开始拖拽绘制一个新的截图框
  };

  // Layout 归一化坐标 → 视觉归一化坐标（CSS rotate 正向变换）
  // cropBox 等所有内部坐标存在 layout 坐标系（参考点 = 未旋转 canvas 的左上角）；
  // 要在视觉上定位悬浮 UI（如 crop toolbar）时必须做这个正向旋转再 × 视觉宽高。
  function layoutToVisualNorm(lx, ly, rotDeg) {
    if (rotDeg === 90)  return { x: 1 - ly, y: lx };
    if (rotDeg === 180) return { x: 1 - lx, y: 1 - ly };
    if (rotDeg === 270) return { x: ly, y: 1 - lx };
    return { x: lx, y: ly };
  }

  // 显示截图悬浮操作栏
  function showCropToolbar() {
    if (!state.cropBox || !UI.elements.cropActionToolbar) return;
    const canvas = UI.elements.annotationCanvas;
    const wrap = UI.elements.previewWrap;
    if (!wrap) return;

    // toolbar 是 preview-wrap 的子元素 (position: absolute)，定位必须相对 preview-wrap。
    // canvas CSS rotate 后视觉包围盒会溢出 preview-wrap，两者左上角不再重合——必须
    // 走"视口绝对坐标 → 相对 preview-wrap 偏移"才能放对位置。
    const canvasRect = canvas.getBoundingClientRect();  // 视觉包围盒（含旋转）
    const wrapRect = wrap.getBoundingClientRect();      // preview-wrap 自己
    const rot = (window.CameraHandler && window.CameraHandler.state.rotationDeg) || 0;

    // cropBox 是 layout 归一化；toolbar 要在视觉布局上定位，4 顶点先正向旋转
    const lx1 = Math.min(state.cropBox.start.x, state.cropBox.end.x);
    const ly1 = Math.min(state.cropBox.start.y, state.cropBox.end.y);
    const lx2 = Math.max(state.cropBox.start.x, state.cropBox.end.x);
    const ly2 = Math.max(state.cropBox.start.y, state.cropBox.end.y);

    const corners = [
      layoutToVisualNorm(lx1, ly1, rot),
      layoutToVisualNorm(lx2, ly1, rot),
      layoutToVisualNorm(lx1, ly2, rot),
      layoutToVisualNorm(lx2, ly2, rot),
    ];
    const vxs = corners.map(c => c.x);
    const vys = corners.map(c => c.y);

    // 视觉归一化 → 视口绝对像素（基于 canvas 视觉包围盒）
    const absX1 = canvasRect.left + Math.min(...vxs) * canvasRect.width;
    const absY1 = canvasRect.top  + Math.min(...vys) * canvasRect.height;
    const absX2 = canvasRect.left + Math.max(...vxs) * canvasRect.width;
    const absY2 = canvasRect.top  + Math.max(...vys) * canvasRect.height;

    // 视口绝对 → 相对 preview-wrap（toolbar 的定位参考系）
    const x1 = absX1 - wrapRect.left;
    const y1 = absY1 - wrapRect.top;
    const x2 = absX2 - wrapRect.left;
    const y2 = absY2 - wrapRect.top;

    // 定位在截图框正下方，如果贴底，则显示在正上方
    let top = y2 + 10;
    const toolbarHeight = 45;
    if (top + toolbarHeight > wrapRect.height) {
      top = y1 - toolbarHeight - 10;
      if (top < 0) top = 10;
    }

    // 水平居中（边界用 wrapRect.width，因为 toolbar 在 preview-wrap 内）
    const width = x2 - x1;
    const toolbarWidth = 180;
    let left = x1 + width / 2 - toolbarWidth / 2;
    if (left < 10) left = 10;
    if (left + toolbarWidth > wrapRect.width) left = wrapRect.width - toolbarWidth - 10;

    UI.elements.cropActionToolbar.style.left = `${left}px`;
    UI.elements.cropActionToolbar.style.top = `${top}px`;
    UI.elements.cropActionToolbar.hidden = false;
  }

  // 隐藏截图悬浮操作栏
  function hideCropToolbar() {
    if (UI.elements.cropActionToolbar) {
      UI.elements.cropActionToolbar.hidden = true;
    }
  }

  // 取消文字编辑（不提交）
  function cancelTextEdit() {
    const container = document.getElementById('textEditorContainer');
    if (container) container.hidden = true;
  }

  // 将文字编辑器内容提交为 text 图形
  function commitText() {
    const container = document.getElementById('textEditorContainer');
    const input = document.getElementById('textEditorInput');
    if (!container || !input || !input.value.trim()) {
      cancelTextEdit();
      return;
    }

    const normX = parseFloat(container.dataset.normX);
    const normY = parseFloat(container.dataset.normY);
    // 字号按显示区域高度归一化，保证缩放后视觉尺寸一致
    const dispH = parseFloat(container.dataset.dispH) || 600;
    const fontSizeNorm = state.currentFontSize / dispH;

    state.undoHistory.push([...state.shapes]);
    if (state.undoHistory.length > 10) state.undoHistory.shift();

    state.shapes.push({
      type: 'text',
      text: input.value,
      color: state.currentColor,
      font: state.currentFont,
      fontSizeNorm,   // 字号 ÷ 显示区高度，渲染时 × canvas.height
      x: normX,
      y: normY,
    });

    cancelTextEdit();
    render();
    UI.log(`插入文字: "${input.value.substring(0, 20)}${input.value.length > 20 ? '…' : ''}"`);
  }

  // 初始化标注模块
  function init() {
    const canvas = UI.elements.annotationCanvas;
    if (!canvas) return;

    // 绑定工具栏切换事件（再次点击已激活工具则取消选中）
    if (UI.elements.annotationToolbar) {
      UI.elements.annotationToolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-tool]');
        if (!btn) return;

        const clickedTool = btn.dataset.tool;
        // 再次点击同一工具 → 取消选中
        if (clickedTool === state.currentTool) {
          state.currentTool = null;
          UI.elements.annotationToolbar.querySelectorAll('button[data-tool]').forEach(b => b.classList.remove('active'));
          hideCropToolbar();
          cancelTextEdit();
          const textBar = document.getElementById('textOptionsBar');
          if (textBar) textBar.hidden = true;
          canvas.style.cursor = '';
          UI.log('工具已取消');
          return;
        }

        state.currentTool = clickedTool;

        // 激活状态样式切换
        UI.elements.annotationToolbar.querySelectorAll('button[data-tool]').forEach(b => {
          b.classList.toggle('active', b === btn);
        });

        // 如果切换为非截图工具，清空截图框并隐藏操作栏
        if (state.currentTool !== 'crop') {
          hideCropToolbar();
          if (state.cropBox) {
            state.cropBox = null;
            render();
          }
        }

        // 文字工具：显示选项栏并改光标；切走时隐藏选项栏和编辑器
        const textBar = document.getElementById('textOptionsBar');
        if (state.currentTool === 'text') {
          if (textBar) textBar.hidden = false;
          canvas.style.cursor = 'text';
        } else {
          if (textBar) textBar.hidden = true;
          cancelTextEdit();
          canvas.style.cursor = '';
        }

        UI.log(`切换到工具: ${state.currentTool}`);
      });
    }

    // 绑定预设颜色圆点点击事件
    if (UI.elements.colorPicker) {
      UI.elements.colorPicker.addEventListener('click', (e) => {
        const dot = e.target.closest('button[data-color]');
        if (!dot) return;

        state.currentColor = dot.dataset.color;

        // 同步自定义颜色 input 的值
        const customInput = document.getElementById('customColorInput');
        if (customInput) customInput.value = state.currentColor;

        // 激活状态样式切换
        UI.elements.colorPicker.querySelectorAll('.color-dot').forEach(d => {
          d.classList.toggle('active', d === dot);
        });

        UI.log(`切换画笔颜色: ${state.currentColor}`);
      });
    }

    // 绑定自定义颜色选择器（<input type="color">）
    const customColorInput = document.getElementById('customColorInput');
    if (customColorInput) {
      customColorInput.addEventListener('input', () => {
        state.currentColor = customColorInput.value;
        // 取消所有预设圆点的激活状态
        if (UI.elements.colorPicker) {
          UI.elements.colorPicker.querySelectorAll('button[data-color]').forEach(d => {
            d.classList.remove('active');
          });
        }
        UI.log(`切换到自定义颜色: ${state.currentColor}`);
      });
    }

    // 撤销上一步（从 history 栈弹出上一个快照）
    if (UI.elements.undoButton) {
      UI.elements.undoButton.addEventListener('click', () => {
        if (state.undoHistory.length > 0) {
          state.shapes = state.undoHistory.pop();
          render();
          UI.log(`已撤销，剩余可撤销步数: ${state.undoHistory.length}`);
        } else if (state.cropBox) {
          state.cropBox = null;
          hideCropToolbar();
          render();
          UI.log('已清除截图区域');
        } else {
          UI.log('没有可撤销的操作');
        }
      });
    }

    // 清空全部（同时清除历史）
    if (UI.elements.clearAnnotationsButton) {
      UI.elements.clearAnnotationsButton.addEventListener('click', () => {
        state.shapes = [];
        state.undoHistory = [];
        state.activeShape = null;
        state.cropBox = null;
        hideCropToolbar();
        render();
        UI.log('清空所有标注与截图框');
      });
    }

    // 绑定截图悬浮操作栏按钮
    if (UI.elements.cropConfirmButton) {
      UI.elements.cropConfirmButton.addEventListener('click', () => {
        hideCropToolbar();
        if (window.CameraHandler) {
          window.CameraHandler.capture();
        }
      });
    }
    if (UI.elements.cropCancelButton) {
      UI.elements.cropCancelButton.addEventListener('click', () => {
        hideCropToolbar();
        state.cropBox = null;
        render();
        UI.log('已取消选区截图');
      });
    }

    // 文字工具：字体/字号选择器
    const textFontSelect = document.getElementById('textFontSelect');
    if (textFontSelect) {
      textFontSelect.addEventListener('change', () => {
        state.currentFont = textFontSelect.value;
      });
    }
    const textSizeSelect = document.getElementById('textSizeSelect');
    if (textSizeSelect) {
      textSizeSelect.addEventListener('change', () => {
        state.currentFontSize = parseInt(textSizeSelect.value, 10);
      });
    }

    // 文字编辑器确认/取消按钮
    const textConfirmBtn = document.getElementById('textConfirmBtn');
    if (textConfirmBtn) textConfirmBtn.addEventListener('click', commitText);
    const textCancelBtn = document.getElementById('textCancelBtn');
    if (textCancelBtn) textCancelBtn.addEventListener('click', cancelTextEdit);

    // 文字输入框：Enter 确认，Shift+Enter 换行，Escape 取消；自动撑高
    const textEditorInput = document.getElementById('textEditorInput');
    if (textEditorInput) {
      textEditorInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          commitText();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelTextEdit();
        }
      });
      textEditorInput.addEventListener('input', () => {
        // 自动撑高 textarea
        textEditorInput.style.height = 'auto';
        textEditorInput.style.height = textEditorInput.scrollHeight + 'px';
      });
    }

    // 画布指针事件绑定
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerCancel);

    // 窗口缩放自适应
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }

  // 重置画布分辨率
  function resizeCanvas() {
    const canvas = UI.elements.annotationCanvas;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;

    // 必须用 offsetWidth/offsetHeight（layout 尺寸），不能用 getBoundingClientRect()
    // CSS rotate 后 getBoundingClientRect 的 width/height 会被交换，导致 pixel buffer
    // 宽高与 CSS 盒子不一致，所有标注坐标全部偏移
    const width = Math.max(1, Math.round(canvas.offsetWidth * ratio));
    const height = Math.max(1, Math.round(canvas.offsetHeight * ratio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    render();

    // 如果 crop toolbar 正在显示（cropBox 还没确认/取消），跟着旋转 / 窗口缩放重新定位
    if (state.cropBox && UI.elements.cropActionToolbar && !UI.elements.cropActionToolbar.hidden) {
      showCropToolbar();
    }
  }

  // 坐标归一化转换
  // 关键：getBoundingClientRect 在 CSS rotate 后返回的是"视觉包围盒"，宽高会被交换；
  // 必须先把视觉坐标逆旋转回 layout 坐标系（参考点 = 未旋转 canvas 的左上角），
  // 再用 offsetWidth/offsetHeight（layout 尺寸）做归一化，否则非正方形画布旋转后
  // 归一化会因为视觉宽高比变化而畸变。
  function getNormalizedPoint(event) {
    const canvas = UI.elements.annotationCanvas;
    const rect = canvas.getBoundingClientRect();
    const rot = (window.CameraHandler && window.CameraHandler.state.rotationDeg) || 0;

    // 视觉坐标（相对视觉包围盒左上角）
    const visX = event.clientX - rect.left;
    const visY = event.clientY - rect.top;

    // layout 尺寸（不受 CSS transform 影响，等于未旋转 canvas 的真实宽高）
    const lw = canvas.offsetWidth;
    const lh = canvas.offsetHeight;

    // 视觉宽高（旋转 90/270 时与 layout 宽高互换）
    const vw = rect.width;
    const vh = rect.height;

    // 把视觉坐标逆旋转回 layout 坐标
    let layoutX, layoutY;
    if (rot === 90) {
      // 视觉 (visX, visY) 对应 layout (visY, vw - visX)，且 vw = lh
      layoutX = visY;
      layoutY = vw - visX;
    } else if (rot === 180) {
      layoutX = vw - visX;
      layoutY = vh - visY;
    } else if (rot === 270) {
      // 视觉 (visX, visY) 对应 layout (vh - visY, visX)，且 vh = lw
      layoutX = vh - visY;
      layoutY = visX;
    } else {
      layoutX = visX;
      layoutY = visY;
    }

    return { x: layoutX / lw, y: layoutY / lh };
  }

  // 指针按下开始绘制
  function handlePointerDown(e) {
    const canvas = UI.elements.annotationCanvas;
    canvas.setPointerCapture(e.pointerId);

    // 无工具选中时不响应画布操作
    if (!state.currentTool) return;

    const pt = getNormalizedPoint(e);

    // 文字工具：在点击位置弹出内联编辑器
    if (state.currentTool === 'text') {
      const rect = canvas.getBoundingClientRect();
      const dispX = pt.x * rect.width;
      const dispY = pt.y * rect.height;

      const container = document.getElementById('textEditorContainer');
      const input = document.getElementById('textEditorInput');
      if (!container || !input) return;

      container.dataset.normX = pt.x;
      container.dataset.normY = pt.y;
      container.dataset.dispH = rect.height;

      // 防止编辑器超出右边界
      const estimatedW = Math.min(240, rect.width - dispX - 10);
      container.style.left = `${dispX}px`;
      container.style.top = `${dispY}px`;
      container.style.maxWidth = `${Math.max(120, estimatedW)}px`;

      input.value = '';
      input.style.height = 'auto';
      input.style.color = state.currentColor;
      input.style.fontFamily = state.currentFont;
      input.style.fontSize = state.currentFontSize + 'px';
      input.style.minWidth = Math.min(120, Math.max(80, estimatedW)) + 'px';

      container.hidden = false;
      // 延迟 focus 以避免 pointerdown 立刻触发 blur
      setTimeout(() => input.focus(), 30);
      return;
    }

    if (state.currentTool === 'crop') {
      if (state.cropBox) {
        // 把手检测用 layout 坐标系：pt 是 layout 归一化；offsetWidth/Height 是 layout 尺寸
        // 不能用 getBoundingClientRect().width/height（旋转后是视觉宽高，跟 pt 坐标系不一致 → 把手位置算飞）
        const layoutW = canvas.offsetWidth;
        const layoutH = canvas.offsetHeight;
        const clickX = pt.x * layoutW;
        const clickY = pt.y * layoutH;

        const x1 = Math.min(state.cropBox.start.x, state.cropBox.end.x) * layoutW;
        const y1 = Math.min(state.cropBox.start.y, state.cropBox.end.y) * layoutH;
        const x2 = Math.max(state.cropBox.start.x, state.cropBox.end.x) * layoutW;
        const y2 = Math.max(state.cropBox.start.y, state.cropBox.end.y) * layoutH;
        const xc = (x1 + x2) / 2;
        const yc = (y1 + y2) / 2;

        const handles = {
          TL: { x: x1, y: y1 },
          TC: { x: xc, y: y1 },
          TR: { x: x2, y: y1 },
          ML: { x: x1, y: yc },
          MR: { x: x2, y: yc },
          BL: { x: x1, y: y2 },
          BC: { x: xc, y: y2 },
          BR: { x: x2, y: y2 }
        };

        // 检测是否点中了 8 个控制点之一（判定阈值 12 像素）
        let hitHandle = null;
        const threshold = 12;
        for (const [name, pos] of Object.entries(handles)) {
          const dist = Math.hypot(clickX - pos.x, clickY - pos.y);
          if (dist <= threshold) {
            hitHandle = name;
            break;
          }
        }

        if (hitHandle) {
          state.dragHandle = hitHandle;
          state.dragStartPoint = pt;
          state.dragStartBox = {
            x1: Math.min(state.cropBox.start.x, state.cropBox.end.x),
            y1: Math.min(state.cropBox.start.y, state.cropBox.end.y),
            x2: Math.max(state.cropBox.start.x, state.cropBox.end.x),
            y2: Math.max(state.cropBox.start.y, state.cropBox.end.y)
          };
          hideCropToolbar();
          return;
        }

        // 检测是否点中了截图框内部以进行整体拖拽移动
        const nX1 = Math.min(state.cropBox.start.x, state.cropBox.end.x);
        const nY1 = Math.min(state.cropBox.start.y, state.cropBox.end.y);
        const nX2 = Math.max(state.cropBox.start.x, state.cropBox.end.x);
        const nY2 = Math.max(state.cropBox.start.y, state.cropBox.end.y);
        
        if (pt.x >= nX1 && pt.x <= nX2 && pt.y >= nY1 && pt.y <= nY2) {
          state.dragHandle = 'MOVE';
          state.dragStartPoint = pt;
          state.dragStartBox = { x1: nX1, y1: nY1, x2: nX2, y2: nY2 };
          hideCropToolbar();
          return;
        }
      }

      // 如果点在其他位置，则开始绘制一个新的截图框
      hideCropToolbar();
      state.isDrawingCrop = true;
      state.cropBox = { start: pt, end: pt };
    } else if (state.currentTool === 'eraser') {
      state.activeShape = {
        type: 'eraser',
        points: [pt]
      };
    } else if (state.currentTool === 'pen') {
      state.activeShape = {
        type: 'pen',
        color: state.currentColor,
        points: [pt]
      };
    } else {
      // 矩形 / 圆形
      state.activeShape = {
        type: state.currentTool,
        color: state.currentColor,
        start: pt,
        end: pt
      };
    }
    render();
  }

  // 指针移动中
  function handlePointerMove(e) {
    if (state.currentTool === 'crop') {
      if (state.dragHandle) {
        const pt = getNormalizedPoint(e);
        const dx = pt.x - state.dragStartPoint.x;
        const dy = pt.y - state.dragStartPoint.y;
        
        const { x1, y1, x2, y2 } = state.dragStartBox;
        let newX1 = x1;
        let newY1 = y1;
        let newX2 = x2;
        let newY2 = y2;
        
        const minSize = 0.01; // 最小尺寸限制
        
        if (state.dragHandle === 'TL') {
          newX1 = Math.min(x2 - minSize, x1 + dx);
          newY1 = Math.min(y2 - minSize, y1 + dy);
        } else if (state.dragHandle === 'TC') {
          newY1 = Math.min(y2 - minSize, y1 + dy);
        } else if (state.dragHandle === 'TR') {
          newX2 = Math.max(x1 + minSize, x2 + dx);
          newY1 = Math.min(y2 - minSize, y1 + dy);
        } else if (state.dragHandle === 'ML') {
          newX1 = Math.min(x2 - minSize, x1 + dx);
        } else if (state.dragHandle === 'MR') {
          newX2 = Math.max(x1 + minSize, x2 + dx);
        } else if (state.dragHandle === 'BL') {
          newX1 = Math.min(x2 - minSize, x1 + dx);
          newY2 = Math.max(y1 + minSize, y2 + dy);
        } else if (state.dragHandle === 'BC') {
          newY2 = Math.max(y1 + minSize, y2 + dy);
        } else if (state.dragHandle === 'BR') {
          newX2 = Math.max(x1 + minSize, x2 + dx);
          newY2 = Math.max(y1 + minSize, y2 + dy);
        } else if (state.dragHandle === 'MOVE') {
          const w = x2 - x1;
          const h = y2 - y1;
          newX1 = x1 + dx;
          newY1 = y1 + dy;
          
          // 整体平移边界约束
          if (newX1 < 0) newX1 = 0;
          if (newY1 < 0) newY1 = 0;
          if (newX1 + w > 1) newX1 = 1 - w;
          if (newY1 + h > 1) newY1 = 1 - h;
          
          newX2 = newX1 + w;
          newY2 = newY1 + h;
        }
        
        // 确保数值在合法归一化区间内 [0, 1]
        newX1 = Math.max(0, Math.min(1, newX1));
        newY1 = Math.max(0, Math.min(1, newY1));
        newX2 = Math.max(0, Math.min(1, newX2));
        newY2 = Math.max(0, Math.min(1, newY2));
        
        state.cropBox = {
          start: { x: newX1, y: newY1 },
          end: { x: newX2, y: newY2 }
        };
        render();
      } else if (state.isDrawingCrop && state.cropBox) {
        state.cropBox.end = getNormalizedPoint(e);
        render();
      }
      return;
    }

    if (!state.activeShape) return;
    const pt = getNormalizedPoint(e);

    if (state.activeShape.type === 'pen' || state.activeShape.type === 'eraser') {
      state.activeShape.points.push(pt);
    } else {
      state.activeShape.end = pt;
    }
    render();
  }

  // 指针抬起完成
  function handlePointerUp(e) {
    const canvas = UI.elements.annotationCanvas;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (state.currentTool === 'crop') {
      if (state.dragHandle) {
        state.dragHandle = null;
        state.dragStartPoint = null;
        state.dragStartBox = null;
        showCropToolbar();
        return;
      }
      
      if (state.isDrawingCrop) {
        state.isDrawingCrop = false;
        // 截图区域结束
        if (state.cropBox) {
          // 防止点按产生极小区域，做极小范围过滤
          const dx = Math.abs(state.cropBox.end.x - state.cropBox.start.x);
          const dy = Math.abs(state.cropBox.end.y - state.cropBox.start.y);
          if (dx < 0.01 || dy < 0.01) {
            state.cropBox = null;
            UI.log('选择区域过小，已取消截图框');
            hideCropToolbar();
          } else {
            // 选区有效，渲染截图框并显示悬浮操作栏
            render();
            showCropToolbar();
          }
        }
      }
      render();
      return;
    }

    if (!state.activeShape) return;
    // 完成一笔前先保存快照到历史栈，最多保留 10 步
    state.undoHistory.push([...state.shapes]);
    if (state.undoHistory.length > 10) state.undoHistory.shift();
    state.shapes.push(state.activeShape);
    state.activeShape = null;
    render();
  }

  // 取消操作
  function handlePointerCancel() {
    state.activeShape = null;
    state.isDrawingCrop = false;
    render();
  }

  // 画具体形状
  function drawShape(ctx, shape, w, h) {
    ctx.save();
    
    // 如果是橡皮擦，采用 destination-out 清理
    if (shape.type === 'eraser') {
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = Math.max(12, Math.round(w * state.eraserWidth));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = 'destination-out';
      
      if (shape.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x * w, shape.points[0].y * h);
        for (const pt of shape.points.slice(1)) {
          ctx.lineTo(pt.x * w, pt.y * h);
        }
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // 文字图形：直接 fillText，不走 stroke 流程
    if (shape.type === 'text') {
      const px = Math.max(12, Math.round(shape.fontSizeNorm * h));
      ctx.font = `bold ${px}px ${shape.font}`;
      ctx.fillStyle = shape.color || '#ff1f1f';
      ctx.textBaseline = 'top';
      // 轻描边增加可读性（任何背景都清晰）
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      const tx = shape.x * w;
      const ty = shape.y * h;
      const lineH = px * 1.3;
      shape.text.split('\n').forEach((line, i) => {
        ctx.fillText(line, tx, ty + i * lineH);
      });
      ctx.restore();
      return;
    }

    ctx.strokeStyle = shape.color || '#ff1f1f';
    ctx.lineWidth = Math.max(3, Math.round(w * 0.0035));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (shape.type === 'rect' || shape.type === 'circle') {
      const x1 = shape.start.x * w;
      const y1 = shape.start.y * h;
      const x2 = shape.end.x * w;
      const y2 = shape.end.y * h;
      
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);

      if (shape.type === 'rect') {
        ctx.strokeRect(left, top, width, height);
      } else {
        ctx.beginPath();
        ctx.ellipse(
          left + width / 2,
          top + height / 2,
          width / 2,
          height / 2,
          0, 0, Math.PI * 2
        );
        ctx.stroke();
      }
    } else if (shape.type === 'pen' && shape.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x * w, shape.points[0].y * h);
      for (const pt of shape.points.slice(1)) {
        ctx.lineTo(pt.x * w, pt.y * h);
      }
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // 渲染函数
  function render() {
    const canvas = UI.elements.annotationCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // 清屏
    ctx.clearRect(0, 0, w, h);

    // 绘制所有固定形状
    for (const shape of state.shapes) {
      drawShape(ctx, shape, w, h);
    }

    // 绘制当前正在画的临时图形
    if (state.activeShape) {
      drawShape(ctx, state.activeShape, w, h);
    }

    // 绘制截图裁剪选区
    if (state.cropBox) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      
      const x1 = state.cropBox.start.x * w;
      const y1 = state.cropBox.start.y * h;
      const x2 = state.cropBox.end.x * w;
      const y2 = state.cropBox.end.y * h;
      
      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const width = Math.abs(x2 - x1);
      const height = Math.abs(y2 - y1);

      ctx.strokeRect(left, top, width, height);
      
      // 遮罩效果
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      // 绘制上下左右四个遮罩矩形
      ctx.fillRect(0, 0, w, top); // 上
      ctx.fillRect(0, top + height, w, h - (top + height)); // 下
      ctx.fillRect(0, top, left, height); // 左
      ctx.fillRect(left + width, top, w - (left + width), height); // 右
      
      
      // 绘制 8 个控制把手
      const handleRadius = 6;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([]); // 把手使用实线绘制
      
      const xc = left + width / 2;
      const yc = top + height / 2;
      
      const handlePoints = [
        { x: left, y: top },          // TL
        { x: xc, y: top },            // TC
        { x: left + width, y: top },    // TR
        { x: left, y: yc },           // ML
        { x: left + width, y: yc },    // MR
        { x: left, y: top + height },   // BL
        { x: xc, y: top + height },      // BC
        { x: left + width, y: top + height } // BR
      ];
      
      for (const pt of handlePoints) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, handleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // 在保存图片时将所有标注单独绘制到一个离屏画布上以防止 destination-out 擦除底图
  function drawOnCapture(targetCtx, w, h) {
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');

    // 把当前已有的形状画在离屏画布上
    for (const shape of state.shapes) {
      drawShape(offCtx, shape, w, h);
    }

    // 把这个透明离屏画布绘制到目标 JPG 画布上
    targetCtx.drawImage(offscreen, 0, 0);
  }

  // 暴露 API
  root.AnnotationHandler = {
    init,
    state,
    render,
    resizeCanvas,
    drawOnCapture,
    hideCropToolbar
  };
})(window);
