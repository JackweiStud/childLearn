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

  // 往最近拍摄列表中添加一条记录
  function addRecentCapture(payload, localImageData) {
    const listElement = UI.elements.recentList;
    if (!listElement) return;

    // 更新计数徽章
    captureCount++;
    const badge = document.getElementById('captureCountBadge');
    if (badge) {
      badge.textContent = captureCount;
      badge.hidden = false;
    }

    const item = document.createElement('li');
    item.className = 'recent-item';
    
    const fileName = payload.imagePath.split('/').pop();
    const sizeStr = `${payload.meta.width} × ${payload.meta.height}`;
    
    item.innerHTML = `
      <img src="${localImageData}" alt="缩略图" />
      <div>
        <strong>${fileName}</strong>
        <span class="recent-meta-text">${sizeStr} (${payload.meta.source})</span>
      </div>
      <div class="recent-actions" style="display: flex; gap: 4px; flex-shrink: 0;">
        <button type="button" class="copy-btn">复制</button>
        <button type="button" class="delete-btn">删除</button>
      </div>
    `;

    // 单击复制路径
    item.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(payload.imagePath).then(() => {
        UI.log(`已复制路径: ${payload.imagePath}`);
        UI.showToast('文件路径已复制');
      });
    });

    // 单击物理删除
    item.querySelector('.delete-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmDelete = confirm(`确认要物理删除此拍摄记录及对应的 JSON 数据吗？\n文件: ${fileName}`);
      if (!confirmDelete) return;

      try {
        UI.log(`正在请求删除文件: ${payload.imagePath}...`);
        const response = await fetch('/api/captures', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ filePath: payload.imagePath })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '删除失败');
        
        // 移除 DOM 节点并更新计数
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

    // 双击调用 macOS 原生 preview
    item.addEventListener('dblclick', () => {
      openFileNatively(payload.imagePath);
    });

    listElement.prepend(item);

    // 限制在 10 项内
    while (listElement.children.length > 10) {
      listElement.lastElementChild.remove();
    }
  }

  root.RecentHandler = {
    init,
    addRecentCapture
  };
})(window);
