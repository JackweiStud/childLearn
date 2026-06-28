const childProcess = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { URL } = require('node:url');

const { createCaptureStore, formatDateDir } = require('./capture-store.cjs');

const repoRoot = process.env.CAMERA_CAPTURE_REPO_ROOT || path.resolve(__dirname, '..', '..', '..');
const publicDir = path.join(__dirname, 'public');
const store = createCaptureStore({ repoRoot });
const port = Number(process.env.PORT || 8731);
const nativePreviewSessions = new Map();

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
      subject: body.subject,
      difficulty: body.difficulty,
      notes: body.notes,
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

async function handleDeleteCapture(req, res) {
  try {
    const body = JSON.parse(await readRequestBody(req, 1024 * 1024));
    const imageFilePath = safeJoin(repoRoot, body.filePath);
    if (!imageFilePath || !imageFilePath.startsWith(store.scansRoot)) {
      sendError(res, 400, 'Invalid file path or permission denied');
      return;
    }

    const parsedPath = path.parse(imageFilePath);
    const metaFilePath = path.join(parsedPath.dir, `${parsedPath.name}.json`);

    let deletedCount = 0;
    if (fs.existsSync(imageFilePath)) {
      fs.unlinkSync(imageFilePath);
      deletedCount++;
    }
    if (fs.existsSync(metaFilePath)) {
      fs.unlinkSync(metaFilePath);
      deletedCount++;
    }

    sendJson(res, 200, { success: true, deleted: imageFilePath, deletedCount });
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

// 列出"今天"目录下的拍摄记录，按 mtime 倒序，最多 limit 条
// 只扫今天目录是有意 trade-off：刷新页面 = 看刚拍的，跨零点拍的看不到（接受）
function handleListCaptures(url, res) {
  try {
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 10));
    const todayDir = path.join(store.scansRoot, formatDateDir(new Date()));

    if (!fs.existsSync(todayDir)) {
      sendJson(res, 200, { items: [] });
      return;
    }

    const items = [];
    for (const name of fs.readdirSync(todayDir)) {
      if (!/\.(jpg|jpeg|png)$/i.test(name)) continue;
      const imagePath = path.join(todayDir, name);
      const metaPath = path.join(todayDir, `${path.parse(name).name}.json`);
      const stat = fs.statSync(imagePath);

      let meta = {};
      if (fs.existsSync(metaPath)) {
        try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) {}
      }

      items.push({
        imagePath,                                              // 绝对路径（给 delete/open-file 用）
        relativeImagePath: path.relative(repoRoot, imagePath).split(path.sep).join('/'),
        url: `/scans/${path.relative(store.scansRoot, imagePath).split(path.sep).join('/')}`, // 给 <img src> 用
        meta,
        mtime: stat.mtimeMs,
      });
    }

    items.sort((a, b) => b.mtime - a.mtime); // 时间倒序，最新在前
    sendJson(res, 200, { items: items.slice(0, limit) });
  } catch (error) {
    sendError(res, 500, error.message);
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

async function handleOpenFile(req, res) {
  try {
    const body = JSON.parse(await readRequestBody(req, 1024 * 1024));
    const filePath = safeJoin(repoRoot, body.filePath);
    if (!filePath || !fs.existsSync(filePath)) {
      sendError(res, 404, 'File not found or invalid path');
      return;
    }
    childProcess.spawn('open', [filePath], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    sendJson(res, 200, { opened: filePath });
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

function parseAvfoundationVideoDevices(output) {
  const devices = [];
  let insideVideoSection = false;

  for (const line of String(output || '').split(/\r?\n/)) {
    if (line.includes('AVFoundation video devices:')) {
      insideVideoSection = true;
      continue;
    }
    if (line.includes('AVFoundation audio devices:')) {
      insideVideoSection = false;
      continue;
    }
    if (!insideVideoSection) continue;

    const match = line.match(/\]\s+\[(\d+)\]\s+(.+)$/);
    if (!match) continue;
    const label = match[2].trim();
    if (/^Capture screen/i.test(label)) continue;
    devices.push({
      index: Number(match[1]),
      label,
    });
  }

  return devices;
}

function listAvfoundationVideoDevices() {
  return new Promise((resolve) => {
    childProcess.execFile(
      'ffmpeg',
      ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''],
      { timeout: 6000 },
      (error, stdout, stderr) => {
        const output = `${stdout || ''}\n${stderr || ''}`;
        resolve({
          devices: parseAvfoundationVideoDevices(output),
          error: error ? error.message : '',
        });
      }
    );
  });
}

function buildAvfoundationCaptureArgs({ deviceIndex, outputPath }) {
  return [
    '-hide_banner',
    '-y',
    '-f',
    'avfoundation',
    '-framerate',
    '30',
    '-i',
    `${deviceIndex}:none`,
    '-frames:v',
    '1',
    outputPath,
  ];
}

function buildAvfoundationPreviewArgs({ deviceIndex }) {
  return [
    '-hide_banner',
    '-loglevel',
    'warning',
    '-f',
    'avfoundation',
    '-framerate',
    '30',
    '-i',
    `${deviceIndex}:none`,
    '-an',
    '-vf',
    'fps=10,scale=1280:-2',
    '-q:v',
    '7',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    'pipe:1',
  ];
}

function extractJpegFrames(buffer) {
  const frames = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const start = buffer.indexOf(Buffer.from([0xff, 0xd8]), cursor);
    if (start === -1) break;
    const end = buffer.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
    if (end === -1) {
      return {
        frames,
        remainder: buffer.subarray(start),
      };
    }
    frames.push(buffer.subarray(start, end + 2));
    cursor = end + 2;
  }

  return {
    frames,
    remainder: Buffer.alloc(0),
  };
}

function parseFfprobeDimensions(output) {
  const payload = JSON.parse(output || '{}');
  const stream = Array.isArray(payload.streams) ? payload.streams[0] : null;
  const width = Number(stream?.width);
  const height = Number(stream?.height);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error('Unable to read captured image dimensions');
  }
  return { width, height };
}

function execFileBuffered(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    childProcess.execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function readImageDimensions(imagePath) {
  const { stdout } = await execFileBuffered('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'json',
    imagePath,
  ], { timeout: 6000 });
  return parseFfprobeDimensions(stdout);
}

async function captureAvfoundationFrame({ deviceIndex, deviceLabel, subject, difficulty, notes }) {
  if (!Number.isInteger(deviceIndex) || deviceIndex < 0) {
    throw new Error('deviceIndex must be a non-negative integer');
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mistake-native-camera-'));
  const tempImagePath = path.join(tempDir, 'frame.jpg');

  try {
    await execFileBuffered(
      'ffmpeg',
      buildAvfoundationCaptureArgs({ deviceIndex, outputPath: tempImagePath }),
      { timeout: 20000 }
    );
    const imageBuffer = fs.readFileSync(tempImagePath);
    const dimensions = await readImageDimensions(tempImagePath);
    return await store.saveCapture({
      imageBuffer,
      mimeType: 'image/jpeg',
      deviceLabel: deviceLabel || `AVFoundation Camera ${deviceIndex}`,
      width: dimensions.width,
      height: dimensions.height,
      quality: {
        capture_mode: 'native-avfoundation',
        avfoundation_index: deviceIndex,
      },
      subject,
      difficulty,
      notes,
    });
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function handleSystemCameras(res) {
  const result = await listAvfoundationVideoDevices();
  sendJson(res, 200, {
    source: 'ffmpeg-avfoundation',
    devices: result.devices,
    warning: result.devices.length === 0 ? result.error : '',
  });
}

async function handleNativeCapture(req, res) {
  try {
    const body = JSON.parse(await readRequestBody(req, 1024 * 1024));
    const deviceIndex = Number(body.deviceIndex);
    const result = await captureAvfoundationFrame({
      deviceIndex,
      deviceLabel: body.deviceLabel || `AVFoundation Camera ${deviceIndex}`,
      subject: body.subject,
      difficulty: body.difficulty,
      notes: body.notes,
    });
    sendJson(res, 201, {
      imagePath: result.relativeImagePath,
      metaPath: result.relativeMetaPath,
      imageUrl: `/scans/${result.relativeImagePath.replace(/^_inbox\/scans\//, '')}`,
      meta: result.meta,
    });
  } catch (error) {
    sendError(res, 400, error.stderr || error.message);
  }
}

function startNativePreviewSession({ deviceIndex, deviceLabel }) {
  if (!Number.isInteger(deviceIndex) || deviceIndex < 0) {
    throw new Error('deviceIndex must be a non-negative integer');
  }

  const sessionId = randomUUID();
  const ffmpeg = childProcess.spawn('ffmpeg', buildAvfoundationPreviewArgs({ deviceIndex }), {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const session = {
    id: sessionId,
    deviceIndex,
    deviceLabel: deviceLabel || `AVFoundation Camera ${deviceIndex}`,
    process: ffmpeg,
    latestFrame: null,
    remainder: Buffer.alloc(0),
    stderr: '',
    startedAt: new Date(),
  };

  nativePreviewSessions.set(sessionId, session);

  ffmpeg.stdout.on('data', (chunk) => {
    const parsed = extractJpegFrames(Buffer.concat([session.remainder, chunk]));
    session.remainder = parsed.remainder;
    if (parsed.frames.length > 0) {
      session.latestFrame = Buffer.from(parsed.frames[parsed.frames.length - 1]);
    }
  });

  ffmpeg.stderr.on('data', (chunk) => {
    session.stderr += chunk.toString('utf8');
    if (session.stderr.length > 8000) session.stderr = session.stderr.slice(-8000);
  });

  ffmpeg.on('close', () => {
    nativePreviewSessions.delete(sessionId);
  });

  ffmpeg.on('error', (error) => {
    session.stderr += `\n${error.message}`;
  });

  return session;
}

function stopNativePreviewSession(sessionId) {
  const session = nativePreviewSessions.get(sessionId);
  if (!session) return false;
  nativePreviewSessions.delete(sessionId);
  if (!session.process.killed) session.process.kill('SIGTERM');
  return true;
}

async function handleStartNativePreview(req, res) {
  try {
    const body = JSON.parse(await readRequestBody(req, 1024 * 1024));
    const deviceIndex = Number(body.deviceIndex);
    const session = startNativePreviewSession({
      deviceIndex,
      deviceLabel: body.deviceLabel || `AVFoundation Camera ${deviceIndex}`,
    });
    sendJson(res, 201, {
      sessionId: session.id,
      deviceIndex: session.deviceIndex,
      deviceLabel: session.deviceLabel,
    });
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

async function handleStopNativePreview(req, res) {
  try {
    const body = JSON.parse(await readRequestBody(req, 1024 * 1024));
    const stopped = stopNativePreviewSession(body.sessionId);
    sendJson(res, 200, { stopped });
  } catch (error) {
    sendError(res, 400, error.message);
  }
}

function handleNativePreviewFrame(url, res) {
  const sessionId = url.searchParams.get('sessionId');
  const session = nativePreviewSessions.get(sessionId);
  if (!session) {
    sendError(res, 404, 'Native preview session not found');
    return;
  }
  if (!session.latestFrame) {
    sendError(res, 425, session.stderr || 'Native preview frame is not ready');
    return;
  }

  res.writeHead(200, {
    'content-type': 'image/jpeg',
    'content-length': session.latestFrame.length,
    'cache-control': 'no-store, no-cache, must-revalidate',
  });
  res.end(session.latestFrame);
}

function handleNativePreview(url, req, res) {
  const deviceIndex = Number(url.searchParams.get('deviceIndex'));
  if (!Number.isInteger(deviceIndex) || deviceIndex < 0) {
    sendError(res, 400, 'deviceIndex must be a non-negative integer');
    return;
  }

  const ffmpeg = childProcess.spawn('ffmpeg', buildAvfoundationPreviewArgs({ deviceIndex }), {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';

  res.writeHead(200, {
    'content-type': 'multipart/x-mixed-replace; boundary=ffmpeg',
    'cache-control': 'no-store, no-cache, must-revalidate',
    connection: 'close',
  });

  ffmpeg.stdout.pipe(res);
  ffmpeg.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });

  const stop = () => {
    if (!ffmpeg.killed) ffmpeg.kill('SIGTERM');
  };
  req.on('close', stop);
  res.on('close', stop);
  ffmpeg.on('error', (error) => {
    if (!res.headersSent) sendError(res, 500, error.message);
  });
  ffmpeg.on('close', () => {
    if (!res.destroyed && stderr) res.end();
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/api/captures') {
    handleCapture(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/captures') {
    handleListCaptures(url, res);
    return;
  }

  if (req.method === 'DELETE' && url.pathname === '/api/captures') {
    handleDeleteCapture(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/open-scans') {
    handleOpenScans(res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/open-file') {
    handleOpenFile(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/system-cameras') {
    handleSystemCameras(res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/native-captures') {
    handleNativeCapture(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/native-preview/start') {
    handleStartNativePreview(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/native-preview/stop') {
    handleStopNativePreview(req, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/native-preview/frame') {
    handleNativePreviewFrame(url, res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/native-preview') {
    handleNativePreview(url, req, res);
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
  buildAvfoundationCaptureArgs,
  buildAvfoundationPreviewArgs,
  extractJpegFrames,
  server,
  decodeDataUrl,
  parseAvfoundationVideoDevices,
  parseFfprobeDimensions,
};
