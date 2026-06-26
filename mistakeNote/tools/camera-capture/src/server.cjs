const childProcess = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const { createCaptureStore } = require('./capture-store.cjs');

const repoRoot = process.env.CAMERA_CAPTURE_REPO_ROOT || path.resolve(__dirname, '..', '..', '..');
const publicDir = path.join(__dirname, 'public');
const store = createCaptureStore({ repoRoot });
const port = Number(process.env.PORT || 8731);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readRequestBody(req, limitBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|jpg|png));base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) throw new Error('Expected a JPEG or PNG data URL');
  return {
    mimeType: match[1] === 'image/jpg' ? 'image/jpeg' : match[1],
    imageBuffer: Buffer.from(match[2], 'base64'),
  };
}

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const target = path.normalize(path.join(root, decoded));
  if (!target.startsWith(root)) return null;
  return target;
}

function serveFile(res, filePath) {
  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      sendError(res, 404, 'Not found');
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': contentTypes[extension] || 'application/octet-stream',
      'content-length': stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleCapture(req, res) {
  try {
    const body = JSON.parse(await readRequestBody(req));
    const { mimeType, imageBuffer } = decodeDataUrl(body.imageData);
    const result = await store.saveCapture({
      imageBuffer,
      mimeType,
      deviceLabel: body.deviceLabel || 'Unknown Camera',
      width: Number(body.width),
      height: Number(body.height),
      quality: body.quality || {},
    });
    sendJson(res, 201, {
      imagePath: result.relativeImagePath,
      metaPath: result.relativeMetaPath,
      imageUrl: `/scans/${result.relativeImagePath.replace(/^_inbox\/scans\//, '')}`,
      meta: result.meta,
    });
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

function handleOpenScans(res) {
  fs.mkdirSync(store.scansRoot, { recursive: true });
  childProcess.spawn('open', [store.scansRoot], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  sendJson(res, 200, { opened: store.scansRoot });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/api/captures') {
    handleCapture(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/open-scans') {
    handleOpenScans(res);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/scans/')) {
    const filePath = safeJoin(store.scansRoot, url.pathname.replace(/^\/scans\//, ''));
    if (!filePath) {
      sendError(res, 400, 'Invalid path');
      return;
    }
    serveFile(res, filePath);
    return;
  }

  if (req.method === 'GET') {
    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = safeJoin(publicDir, requestPath);
    if (!filePath) {
      sendError(res, 400, 'Invalid path');
      return;
    }
    serveFile(res, filePath);
    return;
  }

  sendError(res, 405, 'Method not allowed');
});

if (require.main === module) {
  server.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log(`错题拍照台已启动: ${url}`);
    console.log(`保存目录: ${store.scansRoot}`);
    childProcess.spawn('open', [url], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  });
}

module.exports = {
  server,
  decodeDataUrl,
};
