// recent-handler.js - 管理最近拍摄的图片网格渲染以及双击调用本地大图打开的功能
(function exposeRecentHandler(root) {
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
      <button type="button" class="copy-btn">复制路径</button>
    `;

    // 单击复制路径
    item.querySelector('.copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(payload.imagePath).then(() => {
        UI.log(`已复制路径: ${payload.imagePath}`);
      });
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
