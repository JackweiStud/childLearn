const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

const {
  normalizeSoftwareAdjustments,
  computeZoomCrop,
  cssFilterForAdjustments,
} = require('../../../tools/camera-capture/src/public/capture-effects.js');

test('软件缩放使用中心裁剪并保持输出尺寸不变', () => {
  const crop = computeZoomCrop({
    sourceWidth: 1920,
    sourceHeight: 1080,
    zoom: 2,
  });

  assert.deepEqual(crop, {
    sx: 480,
    sy: 270,
    sWidth: 960,
    sHeight: 540,
  });
});

test('软件调节会被限制在安全范围并可转成 canvas/css filter', () => {
  const adjustments = normalizeSoftwareAdjustments({
    zoom: 9,
    brightness: 20,
    contrast: 999,
    saturation: -5,
  });

  assert.deepEqual(adjustments, {
    zoom: 3,
    brightness: 50,
    contrast: 180,
    saturation: 0,
  });
  assert.equal(cssFilterForAdjustments(adjustments), 'brightness(50%) contrast(180%) saturate(0%)');
});

