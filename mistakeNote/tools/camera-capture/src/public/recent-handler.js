// recent-handler.js - 管理最近拍摄的图片网格渲染以及双击调用本地大图打开的功能
(function exposeRecentHandler(root) {
  // 本次会话的拍摄计数
  let captureCount = 0;

  function init() {
    if (UI.elements.openFolderButton) {
      UI.elements.openFolderButton.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/open-scans', { method: 'POST' });
          if (!res.ok) throw new Error('无法打开文件夹');
          UI.log('已成功在 Finder 中打开保存目录');
        } catch (err) {
          UI.setStatus(`打开文件夹失败: ${err.message}`, 'error');
        }
      });
    }

    // 启动时拉今天已保存的拍摄记录，填充最近拍摄列表
    // 仅初始化拉一次；后续 capture 走 addRecentCapture，不重复 GET
    loadTodayCaptures();
  }

  // 拉取今天目录下的拍摄历史并填充列表（覆盖式渲染）
  async function loadTodayCaptures() {
    try {
      const res = await fetch('/api/captures?limit=10');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.items || [];
      if (items.length === 0) return;

      const listElement = UI.elements.recentList;
      if (!listElement) return;

      // API 返回是 mtime 倒序（最新在前）；直接按顺序 append，最新自然在最上
      items.forEach((it) => {
        renderCaptureItem({
          imagePath: it.imagePath,
          imageSrc: it.url,
          meta: it.meta || {},
        }, { append: true });
      });

      // 更新计数徽章
      captureCount = items.length;
      const badge = document.getElementById('captureCountBadge');
      if (badge) {
        badge.textContent = captureCount;
        badge.hidden = false;
      }

      UI.log(`已加载今天的 ${items.length} 条拍摄记录`);
    } catch (err) {
      UI.log(`加载历史拍摄失败: ${err.message}`, 'warn');
    }
  }

  // 双击调用本地预览打开文件
  async function openFileNatively(filePath) {
    try {
      UI.log(`正在请求系统打开本地文件: ${filePath}...`);
      const response = await fetch('/api/open-file', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '打开文件时后端返回错误');
      UI.log(`系统已成功打开文件: ${filePath}`);
    } catch (err) {
      UI.setStatus(`打开大图失败: ${err.message}`, 'error');
    }
  }

  // 渲染单条拍摄记录到列表
  // entry = { imagePath, imageSrc, meta }
  // imageSrc 可以是 dataURL（新拍）或 /scans/... URL（历史加载）
  // append=false (默认) → prepend 到最前；append=true → 追加到末尾（历史按倒序传入时用）
  function renderCaptureItem(entry, { append = false } = {}) {
    const listElement = UI.elements.recentList;
    if (!listElement) return;

    const { imagePath, imageSrc, meta } = entry;
    const item = document.createElement('li');
    item.className = 'recent-item';

    const fileName = imagePath.split('/').pop();
    const sizeStr = (meta.width && meta.height) ? `${meta.width} × ${meta.height}` : '尺寸未知';
    const sourceStr = meta.source || '';

    item.innerHTML = `
      <img src="${imageSrc}" alt="缩略图" loading="lazy" />
      <div>
        <strong>${fileName}</strong>
        <span class="recent-meta-text">${sizeStr}${sourceStr ? ` (${sourceStr})` : ''}</span>
      </div>
      <div class="recent-actions" style="display: flex; gap: 4px; flex-shrink: 0;">
        <button type="button" class="copy-btn">复制</button>
        <button type="button" class="delete-btn">删除</button>
      </div>
    `;

    item.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(imagePath).then(() => {
        UI.log(`已复制路径: ${imagePath}`);
        UI.showToast('文件路径已复制');
      });
    });

    item.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmDelete = confirm(`确认要物理删除此拍摄记录及对应的 JSON 数据吗？\n文件: ${fileName}`);
      if (!confirmDelete) return;

      try {
        UI.log(`正在请求删除文件: ${imagePath}...`);
        const response = await fetch('/api/captures', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ filePath: imagePath })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '删除失败');

        item.remove();
        captureCount--;
        const badge = document.getElementById('captureCountBadge');
        if (badge) {
          badge.textContent = captureCount;
          if (captureCount <= 0) badge.hidden = true;
        }
        UI.log(`文件物理删除成功: ${fileName}`);
        UI.showToast('文件已物理删除', 'success');
      } catch (err) {
        UI.setStatus(`删除失败: ${err.message}`, 'error');
        UI.showToast(`删除失败: ${err.message}`, 'error');
      }
    });

    item.addEventListener('dblclick', () => {
      openFileNatively(imagePath);
    });

    if (append) listElement.appendChild(item);
    else listElement.prepend(item);

    // 限制在 10 项内
    while (listElement.children.length > 10) {
      listElement.lastElementChild.remove();
    }
  }

  // 新拍照后调用：dataURL 直接显示，无需等待磁盘扫描
  function addRecentCapture(payload, localImageData) {
    captureCount++;
    const badge = document.getElementById('captureCountBadge');
    if (badge) {
      badge.textContent = captureCount;
      badge.hidden = false;
    }
    renderCaptureItem({
      imagePath: payload.imagePath,
      imageSrc: localImageData,
      meta: payload.meta || {},
    });
  }

  root.RecentHandler = {
    init,
    addRecentCapture
  };
})(window);
