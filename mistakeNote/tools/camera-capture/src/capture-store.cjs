const fs = require('node:fs');
const path = require('node:path');

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(number, length = 2) {
  return String(number).padStart(length, '0');
}

function getShanghaiParts(date) {
  const shifted = new Date(date.getTime() + SHANGHAI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

function formatDateDir(date) {
  const parts = getShanghaiParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function formatTimestamp(date) {
  const parts = getShanghaiParts(date);
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}-${pad(parts.hour)}${pad(parts.minute)}${pad(parts.second)}`;
}

function formatShanghaiIso(date) {
  const parts = getShanghaiParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}+08:00`;
}

function sourceSlug(deviceLabel) {
  if (/usb\s*camera/i.test(deviceLabel || '')) return 'usb-camera';
  if (/iphone/i.test(deviceLabel || '')) return 'iphone-camera';
  return 'camera';
}

function extensionFromMime(mimeType) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  throw new Error(`Unsupported image mime type: ${mimeType}`);
}

function nextSequence(dir, timestamp, slug, extension) {
  if (!fs.existsSync(dir)) return 1;
  const names = fs.readdirSync(dir);
  const matcher = new RegExp(`^${timestamp}-${slug}-(\\d{3})\\.${extension}$`);
  let max = 0;
  for (const name of names) {
    const match = matcher.exec(name);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

function createCaptureStore({ repoRoot = path.resolve(__dirname, '..', '..', '..'), now = () => new Date() } = {}) {
  const scansRoot = path.join(repoRoot, '_inbox', 'scans');

  async function saveCapture({ imageBuffer, mimeType, deviceLabel = 'Unknown Camera', width, height, quality = {}, subject = 'math', difficulty = 'none', notes = '' }) {
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new Error('imageBuffer must be a non-empty Buffer');
    }
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      throw new Error('width and height must be positive integers');
    }

    const capturedAt = now();
    const dateDir = formatDateDir(capturedAt);
    const timestamp = formatTimestamp(capturedAt);
    const slug = sourceSlug(deviceLabel);
    const extension = extensionFromMime(mimeType);
    const targetDir = path.join(scansRoot, dateDir);
    fs.mkdirSync(targetDir, { recursive: true });

    const sequence = nextSequence(targetDir, timestamp, slug, extension);
    const baseName = `${timestamp}-${slug}-${pad(sequence, 3)}`;
    const imagePath = path.join(targetDir, `${baseName}.${extension}`);
    const metaPath = path.join(targetDir, `${baseName}.json`);

    fs.writeFileSync(imagePath, imageBuffer);
    const meta = {
      captured_at: formatShanghaiIso(capturedAt),
      source: slug,
      device_label: deviceLabel,
      width,
      height,
      stage: 'raw_scan',
      status: 'unprocessed',
      quality,
      subject,
      difficulty,
      notes,
    };
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

    return {
      imagePath,
      metaPath,
      relativeImagePath: path.relative(repoRoot, imagePath).split(path.sep).join('/'),
      relativeMetaPath: path.relative(repoRoot, metaPath).split(path.sep).join('/'),
      meta,
    };
  }

  return {
    scansRoot,
    saveCapture,
  };
}

module.exports = {
  createCaptureStore,
  formatDateDir,
  formatShanghaiIso,
  formatTimestamp,
};
