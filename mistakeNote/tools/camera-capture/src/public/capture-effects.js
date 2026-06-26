(function exposeCaptureEffects(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.CaptureEffects = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCaptureEffects() {
  const DEFAULT_SOFTWARE_ADJUSTMENTS = {
    zoom: 1,
    brightness: 100,
    contrast: 100,
    saturation: 100,
  };

  const SOFTWARE_CONTROL_DEFS = [
    { key: 'zoom', label: '软件缩放', min: 1, max: 3, step: 0.1, unit: '×' },
    { key: 'brightness', label: '软件亮度', min: 50, max: 150, step: 1, unit: '%' },
    { key: 'contrast', label: '软件对比度', min: 50, max: 180, step: 1, unit: '%' },
    { key: 'saturation', label: '软件饱和度', min: 0, max: 200, step: 1, unit: '%' },
  ];

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeSoftwareAdjustments(input = {}) {
    const normalized = {};
    for (const definition of SOFTWARE_CONTROL_DEFS) {
      const raw = Number(input[definition.key]);
      const fallback = DEFAULT_SOFTWARE_ADJUSTMENTS[definition.key];
      normalized[definition.key] = clamp(
        Number.isFinite(raw) ? raw : fallback,
        definition.min,
        definition.max
      );
    }
    normalized.zoom = Math.round(normalized.zoom * 10) / 10;
    return normalized;
  }

  function computeZoomCrop({ sourceWidth, sourceHeight, zoom }) {
    const normalizedZoom = normalizeSoftwareAdjustments({ zoom }).zoom;
    const sWidth = Math.round(sourceWidth / normalizedZoom);
    const sHeight = Math.round(sourceHeight / normalizedZoom);
    return {
      sx: Math.round((sourceWidth - sWidth) / 2),
      sy: Math.round((sourceHeight - sHeight) / 2),
      sWidth,
      sHeight,
    };
  }

  function cssFilterForAdjustments(input = {}) {
    const adjustments = normalizeSoftwareAdjustments(input);
    return [
      `brightness(${adjustments.brightness}%)`,
      `contrast(${adjustments.contrast}%)`,
      `saturate(${adjustments.saturation}%)`,
    ].join(' ');
  }

  return {
    DEFAULT_SOFTWARE_ADJUSTMENTS,
    SOFTWARE_CONTROL_DEFS,
    normalizeSoftwareAdjustments,
    computeZoomCrop,
    cssFilterForAdjustments,
  };
});
