function initializeMoncolleImageImport(api) {
  'use strict';


  const byId = id => document.getElementById(id);
  const fileInput = byId('partyImageFile');
  const modeInput = byId('partyImageMode');
  const analyzeButton = byId('partyImageAnalyze');
  const workspace = byId('partyImageWorkspace');
  const preview = byId('partyImagePreview');
  const status = byId('partyImageStatus');
  const resultsBox = byId('partyImageResults');
  const resultRows = byId('partyImageResultRows');
  const applyButton = byId('partyImageApply');
  const autoCropButton = byId('partyAutoCrop');
  const cropInputs = {
    x: byId('partyCropX'),
    y: byId('partyCropY'),
    width: byId('partyCropW'),
    height: byId('partyCropH'),
  };

  if (!api || !fileInput || !modeInput || !analyzeButton || !preview) return;

  const byModelId = new Map(api.catalog.filter(entry => entry.modelId).map(entry => [entry.modelId, entry]));
  const byName = new Map(api.catalog.map(entry => [entry.name, entry]));
  const byCatalogId = new Map(api.catalog.map(entry => [entry.id, entry]));
  let sourceImage = null;
  let ocrWorker = null;
  let numericWorker = null;
  let openCvPromise = null;
  let openCvUnavailable = false;
  let visionPromise = null;
  let recognized = [];
  let cropWasAdjusted = false;
  let autoCropRefined = false;
  let smallRow = null;

  const VISION_RUNTIME = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';
  const VISION_CONFIG = './assets/model/character-classifier.json';

  const { t } = moncolleLocale;
  let lastStatus;
  function setStatus(message, ...values) {
    lastStatus = [message, ...values];
    status.textContent = t(message, ...values.map(value => typeof value === 'string' ? t(value) : value));
  }

  window.addEventListener('moncolle-language', () => {
    if (lastStatus) setStatus(...lastStatus);
    if (recognized.length && !resultsBox.hidden) {
      reconcileParty();
      renderResults();
    }
  });

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像を開けませんでした'));
      };
      image.src = url;
    });
  }

  function effectiveMode() {
    if (modeInput.value !== 'auto') return modeInput.value;
    if (!sourceImage) return 'full';
    return sourceImage.naturalWidth / sourceImage.naturalHeight >= 2.7 ? 'party' : 'full';
  }

  function setCropValues(values) {
    cropInputs.x.value = String(values.x);
    cropInputs.y.value = String(values.y);
    cropInputs.width.value = String(values.width);
    cropInputs.height.value = String(values.height);
  }

  function suggestedCropValues() {
    if (effectiveMode() === 'party') return { x: 0, y: 0, width: 100, height: 100 };
    const aspect = sourceImage ? sourceImage.naturalWidth / sourceImage.naturalHeight : 16 / 9;
    return aspect >= 1.5
      ? { x: 21.5, y: 22, width: 65.5, height: 24 }
      : { x: 8, y: 20, width: 84, height: 26 };
  }

  function resetCrop() {
    setCropValues(suggestedCropValues());
    cropWasAdjusted = false;
    autoCropRefined = effectiveMode() === 'party';
    drawPreview();
  }

  function normalizedCropValues(values = null) {
    const source = values || {
      x: cropInputs.x.value,
      y: cropInputs.y.value,
      width: cropInputs.width.value,
      height: cropInputs.height.value,
    };
    const x = Math.min(90, Math.max(0, Number(source.x) || 0));
    const y = Math.min(90, Math.max(0, Number(source.y) || 0));
    return {
      x,
      y,
      width: Math.min(100 - x, Math.max(10, Number(source.width) || 10)),
      height: Math.min(100 - y, Math.max(10, Number(source.height) || 10)),
    };
  }

  function cropRect(values = null) {
    if (!sourceImage) return null;
    const normalized = normalizedCropValues(values);
    return {
      x: sourceImage.naturalWidth * normalized.x / 100,
      y: sourceImage.naturalHeight * normalized.y / 100,
      width: sourceImage.naturalWidth * normalized.width / 100,
      height: sourceImage.naturalHeight * normalized.height / 100,
    };
  }

  function drawCropToCanvas(canvas, rect, targetWidth) {
    const scale = targetWidth / rect.width;
    canvas.width = targetWidth;
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#111722';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(sourceImage, rect.x, rect.y, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
  }

  function makeCropCanvas(values, targetWidth = 840) {
    const canvas = document.createElement('canvas');
    drawCropToCanvas(canvas, cropRect(values), targetWidth);
    return canvas;
  }

  function drawPreview() {
    const rect = cropRect();
    if (!rect) return;
    smallRow = null;
    if (!cropWasAdjusted && rect.width <= 1050 && rect.width / rect.height >= 2.7 && rect.height >= 52) {
      const native = document.createElement('canvas');
      drawCropToCanvas(native, rect, Math.round(rect.width));
      smallRow = window.moncolleCardRow?.normalize(native, preview);
      if (smallRow) return;
    }
    const targetWidth = Math.min(1600, Math.max(1000, Math.round(rect.width)));
    drawCropToCanvas(preview, rect, targetWidth);
  }

  function loadScript(src, isReady = () => true) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (isReady()) resolve();
        else {
          existing.addEventListener('load', resolve, { once: true });
          existing.addEventListener('error', () => reject(new Error('画像解析ライブラリを読み込めませんでした')), { once: true });
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(new Error('画像解析ライブラリを読み込めませんでした'));
      };
      document.head.append(script);
    });
  }

  async function getOcrWorker() {
    if (ocrWorker) return ocrWorker;
    setStatus('初回用のOCRデータを読み込んでいます…');
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', () => Boolean(window.Tesseract));
    ocrWorker = await window.Tesseract.createWorker(['jpn', 'eng'], 1, {
      logger(message) {
        if (!message.progress) return;
        setStatus('OCR準備中… {0}%', Math.round(message.progress * 100));
      },
    });
    await ocrWorker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
    });
    return ocrWorker;
  }

  async function getOpenCv() {
    if (window.cv?.Mat) return window.cv;
    if (openCvUnavailable) throw new Error('OpenCVはこの環境では利用できません');
    if (openCvPromise) return openCvPromise;
    openCvPromise = (async () => {
      setStatus('画像を整えるOpenCVを読み込んでいます…');
      await loadScript('https://docs.opencv.org/4.x/opencv.js', () => Boolean(window.cv));
      if (window.cv && typeof window.cv.then === 'function') window.cv = await window.cv;
      if (window.cv?.Mat) return window.cv;
      return new Promise((resolve, reject) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (window.cv?.Mat) {
            clearInterval(timer);
            resolve(window.cv);
          } else if (Date.now() - started > 15000) {
            clearInterval(timer);
            reject(new Error('OpenCVの初期化が時間内に完了しませんでした'));
          }
        }, 100);
      });
    })();
    try {
      return await openCvPromise;
    } catch (error) {
      openCvPromise = null;
      openCvUnavailable = true;
      throw error;
    }
  }

  async function getVisionModel() {
    if (visionPromise) return visionPromise;
    visionPromise = (async () => {
      setStatus('キャラ画像の判定モデルを読み込んでいます…');
      await loadScript(`${VISION_RUNTIME}ort.min.js`, () => Boolean(window.ort?.InferenceSession));
      window.ort.env.wasm.numThreads = 1;
      window.ort.env.wasm.wasmPaths = VISION_RUNTIME;
      const configResponse = await fetch(VISION_CONFIG, { cache: 'force-cache' });
      if (!configResponse.ok) throw new Error('画像判定の設定を読み込めませんでした');
      const config = await configResponse.json();
      const modelUrl = new URL(`./assets/model/${config.model}`, document.baseURI).href;
      const session = await window.ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });
      return { session, config };
    })();
    try {
      return await visionPromise;
    } catch (error) {
      visionPromise = null;
      throw error;
    }
  }

  function visualViewCanvas(rowCanvas, index, view, size) {
    const slotWidth = rowCanvas.width / 7;
    let sourceX = slotWidth * (index + view.left);
    let sourceY = rowCanvas.height * view.top;
    let sourceWidth = slotWidth * (view.right - view.left);
    let sourceHeight = rowCanvas.height * (view.bottom - view.top);
    if (sourceWidth > sourceHeight) {
      sourceX += (sourceWidth - sourceHeight) / 2;
      sourceWidth = sourceHeight;
    } else if (sourceHeight > sourceWidth) {
      sourceY += (sourceHeight - sourceWidth) / 2;
      sourceHeight = sourceWidth;
    }
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    context.fillStyle = '#1b1d28';
    context.fillRect(0, 0, size, size);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(rowCanvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);
    return canvas;
  }

  function softmaxRow(values) {
    const maximum = Math.max(...values);
    const exponentials = values.map(value => Math.exp(value - maximum));
    const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
    return exponentials.map(value => value / total);
  }

  async function scoreCropCandidates(candidates) {
    const { session, config } = await getVisionModel();
    const size = config.image_size;
    const channelSize = size * size;
    const batchSize = candidates.length * 7;
    const tensorData = new Float32Array(batchSize * 3 * channelSize);
    const mean = [0.485, 0.456, 0.406];
    const deviation = [0.229, 0.224, 0.225];
    const view = { left: 0.05, right: 0.95, top: 0.02, bottom: 0.94 };
    let batchIndex = 0;
    for (const candidate of candidates) {
      const rowCanvas = makeCropCanvas(candidate, 840);
      for (let slot = 0; slot < 7; slot += 1) {
        const canvas = visualViewCanvas(rowCanvas, slot, view, size);
        const pixels = canvas.getContext('2d', { willReadFrequently: true })
          .getImageData(0, 0, size, size).data;
        const base = batchIndex * 3 * channelSize;
        for (let pixel = 0; pixel < channelSize; pixel += 1) {
          const source = pixel * 4;
          tensorData[base + pixel] = (pixels[source] / 255 - mean[0]) / deviation[0];
          tensorData[base + channelSize + pixel] = (pixels[source + 1] / 255 - mean[1]) / deviation[1];
          tensorData[base + channelSize * 2 + pixel] = (pixels[source + 2] / 255 - mean[2]) / deviation[2];
        }
        batchIndex += 1;
      }
    }
    const input = new window.ort.Tensor('float32', tensorData, [batchSize, 3, size, size]);
    const outputMap = await session.run({ image: input });
    const output = outputMap.logits || Object.values(outputMap)[0];
    const classCount = config.labels.length;
    return candidates.map((candidate, candidateIndex) => {
      let total = 0;
      let strongSlots = 0;
      for (let slot = 0; slot < 7; slot += 1) {
        const rowIndex = candidateIndex * 7 + slot;
        const start = rowIndex * classCount;
        const probabilities = softmaxRow(Array.from(output.data.slice(start, start + classCount)))
          .sort((left, right) => right - left);
        const confidence = probabilities[0] || 0;
        const margin = confidence - (probabilities[1] || 0);
        total += confidence * 0.72 + Math.max(0, margin) * 0.28;
        if (confidence >= 0.5 && margin >= 0.18) strongSlots += 1;
      }
      return { values: candidate, score: total / 7 + strongSlots * 0.025 };
    }).sort((left, right) => right.score - left.score);
  }

  async function refineAutomaticCrop() {
    if (!sourceImage || effectiveMode() === 'party') {
      autoCropRefined = true;
      return;
    }
    const base = normalizedCropValues(suggestedCropValues());
    const survey = makeCropCanvas({x:0, y:0, width:100, height:100}, Math.min(2000, sourceImage.naturalWidth));
    const labelCrop = window.moncolleLevelLabels?.findPartyCrop(survey);
    if (labelCrop) {
      setCropValues(labelCrop);
      drawPreview();
      cropWasAdjusted = false;
      autoCropRefined = true;
      return;
    }
    const candidates = [];
    for (const yOffset of [-4.5, -3, -1.5, 0, 1.5, 3, 4.5]) {
      candidates.push(normalizedCropValues({ ...base, y: base.y + yOffset }));
    }
    const [best] = await scoreCropCandidates(candidates);
    if (best) setCropValues(best.values);
    drawPreview();
    cropWasAdjusted = false;
    autoCropRefined = true;
  }

  async function analyzeVisualParty(rowCanvas) {
    const { session, config } = await getVisionModel();
    const size = config.image_size;
    const views = [
      { left: 0, right: 1, top: 0, bottom: 1 },
      { left: 0.05, right: 0.95, top: 0, bottom: 1 },
      { left: 0.08, right: 0.92, top: 0.08, bottom: 0.94 },
      { left: 0.1, right: 0.9, top: 0.15, bottom: 0.88 },
    ];
    const batchSize = 7 * views.length;
    const channelSize = size * size;
    const tensorData = new Float32Array(batchSize * 3 * channelSize);
    const mean = [0.485, 0.456, 0.406];
    const deviation = [0.229, 0.224, 0.225];
    let batchIndex = 0;
    for (let index = 0; index < 7; index += 1) {
      for (const view of views) {
        const canvas = visualViewCanvas(rowCanvas, index, view, size);
        const pixels = canvas.getContext('2d', { willReadFrequently: true })
          .getImageData(0, 0, size, size).data;
        const base = batchIndex * 3 * channelSize;
        for (let pixel = 0; pixel < channelSize; pixel += 1) {
          const source = pixel * 4;
          tensorData[base + pixel] = (pixels[source] / 255 - mean[0]) / deviation[0];
          tensorData[base + channelSize + pixel] = (pixels[source + 1] / 255 - mean[1]) / deviation[1];
          tensorData[base + channelSize * 2 + pixel] = (pixels[source + 2] / 255 - mean[2]) / deviation[2];
        }
        batchIndex += 1;
      }
    }
    const input = new window.ort.Tensor('float32', tensorData, [batchSize, 3, size, size]);
    const outputMap = await session.run({ image: input });
    const output = outputMap.logits || Object.values(outputMap)[0];
    const classCount = config.labels.length;
    const predictions = [];
    for (let slot = 0; slot < 7; slot += 1) {
      const probabilities = Array(classCount).fill(0);
      for (let viewIndex = 0; viewIndex < views.length; viewIndex += 1) {
        const rowIndex = slot * views.length + viewIndex;
        const start = rowIndex * classCount;
        const logits = Array.from(output.data.slice(start, start + classCount));
        const values = softmaxRow(logits);
        values.forEach((value, classIndex) => { probabilities[classIndex] += value / views.length; });
      }
      const order = probabilities
        .map((probability, classIndex) => ({ probability, classIndex }))
        .sort((left, right) => right.probability - left.probability);
      const candidates = order.slice(0, 5).map(candidate => {
        const label = config.labels[candidate.classIndex];
        const entry = byModelId.get(label.id) || byName.get(label.name);
        return entry ? { entry, mutation: 'normal', score: candidate.probability, source: 'vision' } : null;
      }).filter(Boolean);
      const first = candidates[0] || null;
      const second = candidates[1] || null;
      const confidence = first?.score || 0;
      const margin = confidence - (second?.score || 0);
      const thresholds = config.recommended_thresholds || { confidence: 0.8, margin: 0.65 };
      const confidenceThreshold = Math.min(thresholds.confidence, 0.72);
      const marginThreshold = Math.min(thresholds.margin, 0.5);
      const jkAccepted = first?.entry?.name === 'JK' && confidence >= 0.5 && margin >= 0.18;
      predictions.push({
        catalogId: first?.entry.id || '',
        entry: first?.entry || null,
        confidence,
        margin,
        candidates,
        acceptedHigh: Boolean(first && ((confidence >= confidenceThreshold && margin >= marginThreshold) || jkAccepted)),
      });
    }
    return predictions;
  }

  async function recognizeText(worker, canvas, options = {}) {
    await worker.setParameters({
      tessedit_pageseg_mode: options.pageMode || '6',
      tessedit_char_whitelist: options.whitelist || '',
      preserve_interword_spaces: '1',
    });
    const result = await worker.recognize(canvas);
    return result.data.text || '';
  }

  function makeTextCanvas(rowCanvas, index, options = {}) {
    const {
      top = 0,
      bottom = 1,
      left = 0,
      right = 1,
      variant = 'strict',
    } = options;
    const slotWidth = rowCanvas.width / 7;
    const sourceX = Math.round(slotWidth * (index + left));
    const sourceWidth = Math.max(1, Math.round(slotWidth * (right - left)));
    const sourceY = Math.max(0, Math.round(rowCanvas.height * top));
    const sourceHeight = Math.max(1, Math.round(rowCanvas.height * (bottom - top)));
    const scale = Math.min(4, Math.max(2, 360 / sourceWidth));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(rowCanvas, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    if (variant === 'adaptive' && window.cv?.Mat) {
      const source = window.cv.imread(canvas);
      const gray = new window.cv.Mat();
      const blurred = new window.cv.Mat();
      const binary = new window.cv.Mat();
      try {
        window.cv.cvtColor(source, gray, window.cv.COLOR_RGBA2GRAY);
        window.cv.GaussianBlur(gray, blurred, new window.cv.Size(3, 3), 0, 0, window.cv.BORDER_DEFAULT);
        window.cv.adaptiveThreshold(
          blurred,
          binary,
          255,
          window.cv.ADAPTIVE_THRESH_GAUSSIAN_C,
          window.cv.THRESH_BINARY_INV,
          31,
          7,
        );
        window.cv.imshow(canvas, binary);
      } finally {
        source.delete();
        gray.delete();
        blurred.delete();
        binary.delete();
      }
      return canvas;
    }
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const red = image.data[offset];
      const green = image.data[offset + 1];
      const blue = image.data[offset + 2];
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const saturation = maximum ? (maximum - minimum) / maximum : 0;
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      const isWhiteText = variant === 'loose'
        ? luminance >= 112 && saturation <= 0.58
        : variant === 'bright'
          ? luminance >= 128
          : luminance >= 145 && saturation <= 0.4;
      const value = isWhiteText ? 0 : 255;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  function makeOcrCanvas(rowCanvas, index) {
    return makeTextCanvas(rowCanvas, index);
  }

  function makeNameCanvas(rowCanvas, index, variant = 'loose') {
    if (smallRow) return smallLineCanvas(rowCanvas, index, 'name', variant);
    const bottoms = effectiveMode() === 'party'
      ? { strict: 0.24, loose: 0.3, adaptive: 0.34 }
      : { strict: 0.18, loose: 0.22, adaptive: 0.26 };
    return makeTextCanvas(rowCanvas, index, {
      top: 0,
      bottom: bottoms[variant] || 0.22,
      left: 0,
      right: 1,
      variant,
    });
  }

  function makeJkNameCanvas(rowCanvas, index) {
    return makeTextCanvas(rowCanvas, index, {
      top: 0,
      bottom: effectiveMode() === 'party' ? 0.24 : 0.2,
      left: 0.12,
      right: 0.88,
      variant: 'bright',
    });
  }

  function makeLevelCanvas(rowCanvas, index, hasAttackStats, variant = 'loose') {
    if (smallRow) return smallLineCanvas(rowCanvas, index, 'level', variant);
    return makeTextCanvas(rowCanvas, index, {
      // Lv is always drawn at the lower-right of the character card. The old
      // crop included most of the illustration, so OCR often reduced Lv150
      // to a bare 1. Keep this crop on the label itself.
      top: hasAttackStats ? 0.54 : 0.58,
      bottom: hasAttackStats ? 0.82 : 0.92,
      left: 0.5,
      right: 0.97,
      variant,
    });
  }

  function makeLimitCanvas(rowCanvas, index, variant = 'loose') {
    if (smallRow) return smallLineCanvas(rowCanvas, index, 'limit', variant);
    return makeTextCanvas(rowCanvas, index, {
      top: 0,
      bottom: 0.16,
      left: 0.28,
      right: 0.78,
      variant,
    });
  }

  function makeAttackCanvas(rowCanvas, index) {
    return makeTextCanvas(rowCanvas, index, {
      top: 0.81,
      bottom: 1,
      left: 0.06,
      right: 1,
      variant: 'strict',
    });
  }

  function smallLineCanvas(row, index, field, variant) {
    // Coordinates are in card pitches after the seven individual cards have been aligned.
    const bounds = {name:[0,.195,1,.368],level:[.43,.865,1,1.082],
      limit:[.25,.005,.77,.223],attack:[.035,1.143,1,1.40]};
    const [l,t,r,b]=bounds[field], pitch=row.width/7;
    const width=Math.round((r-l)*pitch), height=Math.round((b-t)*pitch);
    const image=row.getContext('2d').getImageData(Math.round((index+l)*pitch),Math.round(t*pitch),width,height);
    const mask=new Uint8Array(width*height);
    let left=width, right=-1, top=height, bottom=-1;
    const low=variant==='strict'?125:variant==='loose'?90:65;
    for(let i=0;i<mask.length;i++) {
      const j=4*i, white=Math.min(image.data[j],image.data[j+1],image.data[j+2]);
      const ink=Math.min(255,Math.max(0,(white-low)*3.6));
      mask[i]=ink;
      if(ink>100) {
        left=Math.min(left,i%width);right=Math.max(right,i%width);
        top=Math.min(top,Math.floor(i/width));bottom=Math.max(bottom,Math.floor(i/width));
      }
    }
    const source=document.createElement('canvas');
    source.width=width;source.height=height;
    for(let i=0;i<mask.length;i++) {
      const gray=255-mask[i], j=4*i;
      image.data[j]=gray;image.data[j+1]=gray;image.data[j+2]=gray;image.data[j+3]=255;
    }
    source.getContext('2d').putImageData(image,0,0);
    if(right<left) return source;
    const w=right-left+1,h=bottom-top+1, scale=Math.min(4,38/h);
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil(w*scale)+20;canvas.height=Math.ceil(h*scale)+20;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(source,left,top,w,h,10,10,w*scale,h*scale);
    return canvas;
  }

  function normalizeText(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[０-９]/g, character => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
      .replace(/[―‐−]/g, 'ー')
      .replace(/苑醒/g, '覚醒')
      .replace(/[^A-Z0-9ァ-ヶー一-龠々]/g, '');
  }

  function levenshtein(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const above = previous[j];
        previous[j] = Math.min(
          previous[j] + 1,
          previous[j - 1] + 1,
          diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
        );
        diagonal = above;
      }
    }
    return previous[right.length];
  }

  function similarityWithin(haystack, needle) {
    if (!haystack || !needle) return 0;
    if (haystack.includes(needle)) return 1;
    let best = 0;
    const shortest = Math.max(1, needle.length - 2);
    const longest = Math.min(haystack.length, needle.length + 2);
    for (let length = shortest; length <= longest; length += 1) {
      for (let start = 0; start + length <= haystack.length; start += 1) {
        const part = haystack.slice(start, start + length);
        const score = 1 - levenshtein(part, needle) / Math.max(part.length, needle.length);
        if (score > best) best = score;
      }
    }
    return best;
  }

  function catalogAliases(entry) {
    const aliases = [{ text: entry.name, mutation: 'normal' }];
    if (entry.nameEn && entry.nameEn !== entry.name) aliases.push({ text: entry.nameEn, mutation: 'normal' });
    if (entry.category === 'illusion') {
      aliases.push(
        { text: `闇${entry.name}`, mutation: 'dark' },
        { text: `漆黒${entry.name}`, mutation: 'dark' },
        { text: `覚醒${entry.name}`, mutation: 'awakened' },
      );
      if (entry.nameEn) aliases.push(
        { text: 'Dark ' + entry.nameEn, mutation: 'dark' },
        { text: entry.nameEn + ' EX', mutation: 'awakened' },
      );
    }
    return aliases.map(alias => ({ ...alias, normalized: normalizeText(alias.text) }));
  }
  const aliasesById = new Map(api.catalog.map(entry => [entry.id, catalogAliases(entry)]));

  function rankCatalog(text) {
    const sources = String(text || '')
      .split(/[\r\n|]+/)
      .map(line => normalizeText(line)
        .replace(/[LI1][VY][0-9]{1,3}/g, '')
        .replace(/[0-9]{1,3}凸/g, '')
        .replace(/[0-9]+/g, ''))
      .filter(Boolean);
    if (!sources.length) sources.push(normalizeText(text).replace(/[0-9]+/g, ''));
    const matches = [];
    for (const entry of api.catalog) {
      let best = { entry, mutation: 'normal', score: 0 };
      for (const alias of aliasesById.get(entry.id)) {
        const needle = alias.normalized;
        for (const source of sources) {
          if (/^[A-Z]+$/.test(needle) && !/[A-Z]/.test(source)) continue;
          const fullScore = 1 - levenshtein(source, needle) / Math.max(source.length, needle.length);
          const partialCap = needle.length <= 3 ? 0.55 : needle.length <= 4 ? 0.68 : 0.84;
          const partialScore = similarityWithin(source, needle) * partialCap;
          const exactScore = source === needle ? 1 : source.includes(needle) ? (needle.length <= 3 ? 0.7 : 0.96) : 0;
          const score = Math.max(fullScore, partialScore, exactScore);
          if (score > best.score) best = { entry, mutation: alias.mutation, score };
        }
      }
      matches.push(best);
    }
    return matches.sort((left, right) => right.score - left.score);
  }

  function mergeCatalogMatches(texts) {
    const byEntry = new Map();
    for (const text of texts.filter(Boolean)) {
      for (const match of rankCatalog(text)) {
        const previous = byEntry.get(match.entry.id);
        if (!previous || match.score > previous.score) byEntry.set(match.entry.id, match);
      }
    }
    return [...byEntry.values()].sort((left, right) => right.score - left.score);
  }

  function findBestCatalog(texts) {
    const matches = mergeCatalogMatches(Array.isArray(texts) ? texts : [texts]);
    const best = matches[0] || { entry: null, mutation: 'normal', score: 0 };
    return best.score >= 0.38 ? best : { entry: null, mutation: 'normal', score: best.score };
  }

  function decideCatalogFromNameReads(texts) {
    const votes = new Map();
    texts.filter(Boolean).forEach(text => {
      const match = findBestCatalog([text]);
      if (!match.entry || match.score < 0.45) return;
      const vote = votes.get(match.entry.id) || { entry: match.entry, count: 0, total: 0, best: 0 };
      vote.count += 1;
      vote.total += match.score;
      vote.best = Math.max(vote.best, match.score);
      votes.set(match.entry.id, vote);
    });
    const rankedVotes = [...votes.values()].sort((left, right) =>
      right.count - left.count || right.total - left.total || right.best - left.best);
    const winner = rankedVotes[0];
    const merged = findBestCatalog(texts);
    const agreed = winner && winner.count >= 2 && winner.total / winner.count >= 0.5;
    const exact = merged.entry && merged.score >= 0.9;
    const entry = agreed ? winner.entry : exact ? merged.entry : null;
    return {
      entry,
      accepted: Boolean(entry),
      confidence: agreed ? winner.total / winner.count : exact ? merged.score : merged.score,
    };
  }

  function fuseCatalogDecision(ocrDecision, visualDecision) {
    const ocrEntry = ocrDecision.entry || null;
    const visualEntry = visualDecision?.entry || null;
    if (ocrEntry && visualEntry && ocrEntry.id === visualEntry.id) {
      return {
        entry: ocrEntry,
        accepted: true,
        confidence: Math.max(ocrDecision.confidence, visualDecision.confidence),
        source: 'ocr+vision',
        conflict: false,
      };
    }
    if (ocrEntry && (!visualEntry || visualDecision.confidence < 0.42 || visualDecision.margin < 0.12)) {
      return {
        entry: ocrEntry,
        accepted: true,
        confidence: ocrDecision.confidence,
        source: 'ocr',
        conflict: false,
      };
    }
    if (ocrEntry && ocrDecision.confidence >= 0.92 && !visualDecision?.acceptedHigh) {
      return {
        entry: ocrEntry,
        accepted: true,
        confidence: ocrDecision.confidence,
        source: 'ocr',
        conflict: Boolean(visualEntry),
      };
    }
    if (visualEntry && visualDecision.acceptedHigh && (!ocrEntry || ocrDecision.confidence < 0.78)) {
      return {
        entry: visualEntry,
        accepted: true,
        confidence: visualDecision.confidence,
        source: 'vision',
        conflict: Boolean(ocrEntry),
      };
    }
    return {
      entry: null,
      accepted: false,
      confidence: Math.max(ocrDecision.confidence || 0, visualDecision?.confidence || 0),
      source: 'hold',
      conflict: Boolean(ocrEntry && visualEntry && ocrEntry.id !== visualEntry.id),
    };
  }

  function mergeCandidateSources(ocrMatches, visualMatches) {
    const candidates = new Map();
    for (const candidate of [...(ocrMatches || []), ...(visualMatches || [])]) {
      const previous = candidates.get(candidate.entry.id);
      if (!previous || candidate.score > previous.score) candidates.set(candidate.entry.id, candidate);
    }
    return [...candidates.values()].sort((left, right) => right.score - left.score);
  }

  function rgbToHsv(red, green, blue) {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    const difference = maximum - minimum;
    let hue = 0;
    if (difference) {
      if (maximum === r) hue = ((g - b) / difference) % 6;
      else if (maximum === g) hue = (b - r) / difference + 2;
      else hue = (r - g) / difference + 4;
      hue = ((hue * 60) + 360) % 360;
    }
    return { hue, saturation: maximum ? difference / maximum : 0, value: maximum };
  }

  function mutationBackgroundFeatures(rowCanvas, index) {
    const slotWidth = rowCanvas.width / 7;
    const startX = Math.round(slotWidth * index);
    const width = Math.max(1, Math.round(slotWidth));
    const context = rowCanvas.getContext('2d');
    const image = context.getImageData(startX, 0, Math.min(width, rowCanvas.width - startX), rowCanvas.height);
    const hueBins = Array(12).fill(0);
    let samples = 0;
    let saturated = 0;
    let yellow = 0;
    let purple = 0;
    let bright = 0;
    let valueTotal = 0;
    let saturationTotal = 0;
    const sampleWidth = image.width;
    const sampleHeight = image.height;
    const step = Math.max(2, Math.round(Math.min(sampleWidth, sampleHeight) / 70));
    for (let y = Math.round(sampleHeight * 0.13); y < sampleHeight * 0.76; y += step) {
      for (let x = Math.round(sampleWidth * 0.1); x < sampleWidth * 0.9; x += step) {
        const xRatio = x / sampleWidth;
        const yRatio = y / sampleHeight;
        const backgroundZone = xRatio <= 0.3 || xRatio >= 0.7 || yRatio <= 0.25;
        if (!backgroundZone) continue;
        const offset = (y * sampleWidth + x) * 4;
        const hsv = rgbToHsv(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
        if (hsv.value < 0.06) continue;
        samples += 1;
        valueTotal += hsv.value;
        saturationTotal += hsv.saturation;
        if (hsv.value > 0.7) bright += 1;
        if (hsv.saturation > 0.38 && hsv.value > 0.2) {
          saturated += 1;
          hueBins[Math.min(11, Math.floor(hsv.hue / 30))] += 1;
          if (hsv.hue >= 38 && hsv.hue <= 82) yellow += 1;
          if (hsv.hue >= 245 && hsv.hue <= 335) purple += 1;
        }
      }
    }
    if (!samples) return null;
    const saturatedRatio = saturated / samples;
    const brightRatio = bright / samples;
    const averageValue = valueTotal / samples;
    const averageSaturation = saturationTotal / samples;
    const activeHueBins = hueBins.filter(count => count >= Math.max(3, saturated * 0.018)).length;
    return {
      samples,
      saturatedRatio,
      brightRatio,
      averageValue,
      averageSaturation,
      activeHueBins,
      yellowRatio: yellow / samples,
      purpleRatio: purple / samples,
    };
  }

  function classifyNormalMutation(rowCanvas, index) {
    const features = mutationBackgroundFeatures(rowCanvas, index);
    if (!features) return { mutation: 'normal', confidence: 0 };
    if (features.activeHueBins >= 7 && features.saturatedRatio >= 0.28 && features.brightRatio >= 0.24) {
      return { mutation: 'rainbow', confidence: 0.94 };
    }
    if (features.yellowRatio >= 0.26 && features.brightRatio >= 0.38 && features.activeHueBins <= 6) {
      return { mutation: 'shiny', confidence: 0.92 };
    }
    if (features.brightRatio < 0.28 && features.averageValue <= 0.46) {
      return { mutation: 'dark', confidence: 0.9 };
    }
    const normalConfidence = features.brightRatio >= 0.38 && features.averageSaturation <= 0.34 ? 0.88 : 0.68;
    return { mutation: 'normal', confidence: normalConfidence };
  }

  function grayscaleCardScore(rowCanvas, index) {
    const slotWidth = rowCanvas.width / 7;
    const startX = Math.round(slotWidth * index);
    const width = Math.max(1, Math.round(slotWidth));
    const image = rowCanvas.getContext('2d').getImageData(
      startX,
      0,
      Math.min(width, rowCanvas.width - startX),
      rowCanvas.height,
    );
    const step = Math.max(2, Math.round(Math.min(image.width, image.height) / 70));
    let samples = 0;
    let grayscale = 0;
    for (let y = Math.round(image.height * 0.2); y < image.height * 0.78; y += step) {
      for (let x = Math.round(image.width * 0.28); x < image.width * 0.92; x += step) {
        const offset = (y * image.width + x) * 4;
        const hsv = rgbToHsv(image.data[offset], image.data[offset + 1], image.data[offset + 2]);
        if (hsv.value < 0.06) continue;
        samples += 1;
        if (hsv.saturation <= 0.18) grayscale += 1;
      }
    }
    return samples ? grayscale / samples : 0;
  }

  function classifyCatalogMutation(entry, nameTexts, rowCanvas, index, fallbackText = '', background = null) {
    if (!entry) return { mutation: 'normal', confidence: 0 };
    if (entry.category === 'normal') return classifyNormalMutation(rowCanvas, index);
    if (entry.category !== 'illusion') return { mutation: 'normal', confidence: 0 };
    const normalizedNames = nameTexts.filter(Boolean).map(normalizeText);
    const baseNames = [entry.name, entry.nameEn].filter(Boolean).map(normalizeText);
    const english = entry.nameEn && normalizeText(entry.nameEn);
    const awakened = text => text.includes('覚醒') || (english && text.includes(english + 'EX'));
    const dark = text => text.includes('闇') || text.includes('漆黒') || (english && text.includes('DARK' + english));
    const awakenedVotes = normalizedNames.filter(awakened).length;
    const darkVotes = normalizedNames.filter(dark).length;
    if (awakenedVotes > darkVotes && awakenedVotes > 0) return { mutation: 'awakened', confidence: 0.99 };
    if (darkVotes > awakenedVotes && darkVotes > 0) return { mutation: 'dark', confidence: 0.99 };
    const fallback = normalizeText(fallbackText);
    if (awakened(fallback) && !dark(fallback)) return { mutation: 'awakened', confidence: 0.93 };
    if (dark(fallback) && !awakened(fallback)) {
      return { mutation: 'dark', confidence: 0.93 };
    }
    const bare = normalizedNames.filter(text => baseNames.includes(text)).length;
    if (bare >= 2) return {mutation:'normal', confidence:0.84};
    background ||= classifyNormalMutation(rowCanvas, index);
    if (background.mutation === 'rainbow' && background.confidence >= 0.9) {
      return { mutation: 'awakened', confidence: 0.88 };
    }
    if (background.mutation === 'dark' && background.confidence >= 0.88) {
      return { mutation: 'dark', confidence: 0.86 };
    }
    const repeatedBaseName = normalizedNames.filter(text => baseNames.some(name => text.includes(name))).length;
    return { mutation: 'normal', confidence: repeatedBaseName >= 2 ? 0.88 : 0.55 };
  }

  function parseLevelDirect(text) {
    const cleaned = String(text || '').normalize('NFKC').toUpperCase();
    const match = cleaned.match(/[L1I|]\s*[VY]\s*([0-9OI]{1,3})(?![0-9OI]|[.,]\s*\d|\s*[KMBT]\b)/);
    const value = match && Number(match[1].replace(/O/g,'0').replace(/I/g,'1'));
    return value >= 1 && value <= 150 ? value : null;
  }


  function parseDedicatedLevel(text) {
    const direct = parseLevelDirect(text);
    if (direct) return { level: direct, locked: true, source: 'explicit' };
    const cleaned = normalizeText(text).replace(/[OＯ]/g, '0').replace(/[IＩ]/g, '1');
    const numericOnly = cleaned.match(/^([0-9]{1,3})$/);
    const numericLevel = numericOnly ? Number(numericOnly[1]) : null;
    return numericLevel >= 1 && numericLevel <= 150
      // A bare digit is only a hint: Lv150/Lv120/Lv100 commonly become 1 or 2.
      ? { level: numericLevel, locked: false, source: 'numeric' }
      : { level: null, locked: false, source: 'none' };
  }

  async function readLevelText(worker, index, fullText) {
    const wholeCard = parseLevelDirect(fullText);
    const votes = new Map();
    let numericHint = '';
    for (const variant of ['loose', 'strict', 'adaptive']) {
      const text = await recognizeText(worker, makeLevelCanvas(preview, index, true, variant), {
        pageMode:'7', whitelist:'0123456789LlVvIiOoYy',
      });
      const read = parseDedicatedLevel(text);
      if (read.locked) {
        votes.set(read.level, (votes.get(read.level) || 0) + 1);
        if (read.level === wholeCard || votes.get(read.level) >= 2) return `Lv${read.level}`;
      } else if (read.level) numericHint = String(read.level);
    }
    if (wholeCard && (!votes.size || votes.has(wholeCard))) return `Lv${wholeCard}`;
    if (!wholeCard && votes.size === 1) return `Lv${votes.keys().next().value}`;
    return numericHint;
  }

  function limitObservation(text, allowBare = false) {
    const normalized = String(text || '').normalize('NFKC').toUpperCase().replace(/O/g, '0');
    const match = normalized.match(/(?<![\d])([0-9]{1,2})\s*凸/) || (allowBare && normalized.trim().match(/^(\d{1,2})$/));
    if (!match || Number(match[1]) > 10) return null;
    return {value:Number(match[1]), quality:match[0].includes('凸') ? 0.96 : 0.50};
  }

  async function collectLimit(worker, index, fullText, preliminary) {
    const fromCard = limitObservation(fullText);
    if (fromCard || (preliminary && !api.supportsLimitBreak(preliminary.category))) return fromCard;
    const options = {pageMode:'7', whitelist:'0123456789凸'};
    const first = limitObservation(await recognizeText(worker, makeLimitCanvas(preview, index), options), true);
    if (!first || first.quality > 0.9) return first;
    const other = limitObservation(await recognizeText(worker, makeLimitCanvas(preview, index, 'adaptive'), options), true);
    if (other?.quality > 0.9) return other;
    return first.value === other?.value ? {...first, quality:0.71} : null;
  }

  function observationsForMutation(nameTexts, fullText, index) {
    const decisions = {};
    const background = classifyNormalMutation(preview, index);
    decisions.normal = {value:background.mutation, quality:background.confidence};
    for (const entry of api.catalog.filter(c => c.category === 'illusion')) {
      const result = classifyCatalogMutation(entry, nameTexts, preview, index, fullText, background);
      decisions[entry.id] = {value:result.mutation, quality:result.confidence};
    }
    return decisions;
  }

  function addCatalogOptions(select) {
    select.add(new Option(t('要確認・キャラを選択'), ''));
    for (const [category, label] of Object.entries(api.categoryLabels)) {
      const group = document.createElement('optgroup');
      group.label = t(label);
      for (const entry of api.catalog.filter(item => item.category === category)) {
        group.append(new Option(entry.label, entry.id));
      }
      select.append(group);
    }
  }

  function setMutationOptions(select, item) {
    const entry = byCatalogId.get(item.catalogId);
    const options = api.mutations[entry?.category] || [{id:'normal', label:'—'}];
    select.replaceChildren();
    if (options.length > 1) select.add(new Option(t('変異を確認'), ''));
    for (const option of options) select.add(new Option(t(option.label), option.id));
    select.value = options.length === 1 ? options[0].id : item.mutation;
    item.mutation = select.value;
    select.disabled = options.length === 1;
  }

  function validInteger(value, min, max) {
    return value !== '' && value != null && Number.isInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
  }

  function readyToApply(item) {
    return Boolean(item.catalogId && item.mutation && validInteger(item.level, 1, 150) && validInteger(item.limitBreak, 0, 10));
  }

  function updateApplyButton() {
    const count = recognized.filter(readyToApply).length;
    applyButton.disabled = count === 0;
    applyButton.textContent = count ? t`選択済みの${count}体を編成に反映` : t('反映するキャラを確認してください');
  }

  function reconcileParty() {
    const observations = recognized.map(item => item.manualId
      ? {...item.observation, manualId:item.manualId, identity:item.manualId} : item.observation);
    const verdicts = window.moncolleConsensus.resolveParty(api, observations);
    recognized.forEach((item, i) => {
      if (item.edited) return;
      const verdict = verdicts[i];
      item.verdict = verdict;
      item.catalogId = verdict.id;
      item.level = verdict.values.level ?? '';
      item.limitBreak = verdict.id ? verdict.values.limit ?? '' : item.observation.limit?.value ?? '';
      item.mutation = verdict.id ? verdict.values.mutation ?? '' : '';
    });
  }

  function fieldList(fields) {
    return fields.map(field => t(field)).join(moncolleLocale.language === 'en' ? ', ' : '・');
  }

  function renderResults() {
    resultRows.replaceChildren();
    recognized.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'image-result-row';
      row.dataset.index = String(index);

      const number = document.createElement('span');
      number.className = 'slot-no';
      number.textContent = String(index + 1);

      const catalog = document.createElement('select');
      catalog.className = 'import-catalog';
      catalog.setAttribute('aria-label', t`画像のキャラ${index + 1}`);
      addCatalogOptions(catalog);
      catalog.value = item.catalogId;

      const mutation = document.createElement('select');
      mutation.className = 'import-mutation';
      mutation.setAttribute('aria-label', t`画像のキャラ${index + 1}の変異`);
      setMutationOptions(mutation, item);

      const level = document.createElement('input');
      level.className = 'import-level';
      level.type = 'number';
      level.min = '1';
      level.max = '150';
      level.value = String(item.level);
      level.setAttribute('aria-label', t`画像のキャラ${index + 1}のレベル`);

      const limit = document.createElement('input');
      limit.className = 'import-limit';
      limit.type = 'number';
      limit.min = '0';
      limit.max = '10';
      limit.value = String(item.limitBreak);
      limit.setAttribute('aria-label', t`画像のキャラ${index + 1}の凸数`);

      const raw = document.createElement('div');
      raw.className = 'raw';
      const {verdict, observation} = item;
      const summary = verdict.evidence.length ? t('照合項目 {0}', fieldList(verdict.evidence)) : '';
      const matching = !verdict.id && verdict.candidates.length ? t('候補 {0}', verdict.candidates.map(c => c.label).join(' / ')) : '';
      const missing = verdict.id ? [item.level === '' && 'Lv', item.limitBreak === '' && '凸', !item.mutation && '変異'].filter(Boolean) : [];
      if (!verdict.id && verdict.candidates.length) {
        const group = document.createElement('optgroup');
        group.label = t('照合候補');
        for (const entry of verdict.candidates) group.append(new Option(entry.label, entry.id));
        catalog.insertBefore(group, catalog.children[1]);
      }
      raw.textContent = [verdict.reason && t('要確認　{0}', verdict.reason), missing.length && t('要確認　{0}', fieldList(missing)), matching, verdict.detail, summary,
        observation.attack?.label && t('読取攻撃力 {0}', observation.attack.label),
        verdict.inferred.length && t('計算から推定　{0}', fieldList(verdict.inferred))].filter(Boolean).join('｜');
      level.placeholder = t('Lv確認');
      limit.placeholder = t('凸確認');
      if (item.edited) raw.textContent = [t('手動で編集中'), observation.attack?.label && t('読取攻撃力 {0}', observation.attack.label)].filter(Boolean).join('｜');
      const edited = () => {
        item.edited = true;
        raw.textContent = [t('手動で編集中'), observation.attack?.label && t('読取攻撃力 {0}', observation.attack.label)].filter(Boolean).join('｜');
        updateApplyButton();
      };
      catalog.addEventListener('change', () => {
        item.catalogId = catalog.value;
        item.manualId = catalog.value;
        const entry = byCatalogId.get(item.catalogId);
        const form = observation.mutations[entry?.id] || observation.mutations[entry?.category];
        item.mutation = form?.quality >= 0.7 ? form.value : '';
        setMutationOptions(mutation, item);
        limit.disabled = !api.supportsLimitBreak(entry?.category);
        item.limitBreak = entry && limit.disabled ? 0 : observation.limit?.quality >= 0.7 ? observation.limit.value : '';
        limit.value = String(item.limitBreak);
        item.level = observation.level?.quality >= 0.7 ? observation.level.value : '';
        level.value = String(item.level);
        edited();
        reconcileParty();
        renderResults();
        resultRows.children[index]?.querySelector('.import-catalog')?.focus();
      });
      mutation.addEventListener('change', () => { item.mutation = mutation.value; edited(); });
      level.addEventListener('input', () => { item.level = level.value; edited(); });
      limit.addEventListener('input', () => { item.limitBreak = limit.value; edited(); });

      const initialEntry = byCatalogId.get(item.catalogId);
      limit.disabled = !api.supportsLimitBreak(initialEntry?.category);
      row.append(number, catalog, mutation, level, limit, raw);
      resultRows.append(row);
    });
    updateApplyButton();
    resultsBox.hidden = false;
  }

  async function analyzeImage() {
    if (!sourceImage) return;
    analyzeButton.disabled = true;
    resultsBox.hidden = true;
    try {
      if (effectiveMode() === 'full' && !cropWasAdjusted && !autoCropRefined) {
        setStatus('画像モデルで編成部分を自動検出しています…');
        try {
          await refineAutomaticCrop();
        } catch (error) {
          console.warn('自動切り取りの位置補正を省略します', error);
          autoCropRefined = true;
          drawPreview();
        }
      }
      const visualTask = analyzeVisualParty(preview).catch(error => {
        console.warn('画像モデルを使わずOCRで解析を続けます', error);
        return Array.from({ length: 7 }, () => null);
      });
      const worker = await getOcrWorker();
      try {
        await getOpenCv();
      } catch (error) {
        console.warn('OpenCVを使わずに解析を続けます', error);
      }
      recognized = [];
      const glyphLevels = window.moncolleLevelLabels?.readRow(preview) || [];
      if (smallRow && !window.moncolleCardSignatures) {
        try { await loadScript('./assets/model/card-signatures.js?v=18.10', () => Boolean(window.moncolleCardSignatures)); }
        catch (error) { console.warn('カード画像の照合データを読み込めませんでした', error); }
      }
      const artReads = smallRow ? window.moncolleCardRow.matchArt(smallRow.readings) : [];
      let smallLabels = [];
      let digitsWorker=worker;
      if (smallRow) {
        try { smallLabels = window.moncolleSmallLabels?.read(smallRow) || []; }
        catch (error) { console.warn('小さい文字の字形照合を省略します', error); }
        try {
          numericWorker ||= await window.Tesseract.createWorker('eng',1);
          digitsWorker=numericWorker;
        } catch (error) { console.warn('既存のOCRで数字を読み取ります',error); }
      }
      const nameRecords = [];
      for (let index = 0; index < 7; index += 1) {
        setStatus('キャラ{0}/7の名前を読み取っています…', index + 1);
        const nameTexts = [];
        for (const variant of ['strict', 'loose', 'adaptive']) {
          nameTexts.push(await recognizeText(worker, makeNameCanvas(preview, index, variant), { pageMode: '7' }));
        }
        nameRecords.push({
          index,
          nameTexts,
          decision: decideCatalogFromNameReads(nameTexts),
        });
      }
      const visualPredictions = await visualTask;

      for (const record of nameRecords) {
        const { index, nameTexts, decision } = record;
        const visualDecision = visualPredictions[index];
        setStatus('キャラ{0}/7のLv・凸を読み取っています…', index + 1);
        const fullText = await recognizeText(worker, makeOcrCanvas(preview, index));
        let expandedDecision = decision.accepted
          ? decision
          : decideCatalogFromNameReads([...nameTexts, fullText]);
        if (!expandedDecision.accepted) {
          const jkText = await recognizeText(worker, makeJkNameCanvas(preview, index), {
            pageMode: '7',
            whitelist: 'JKjk',
          });
          if (normalizeText(jkText).includes('JK') && grayscaleCardScore(preview, index) >= 0.74) {
            const jk = byCatalogId.get('jk');
            if (jk) expandedDecision = { entry: jk, accepted: true, confidence: 0.96 };
          }
        }
        const fusedDecision = fuseCatalogDecision(expandedDecision, visualDecision);
        const levelText = glyphLevels[index]
          ? `Lv${glyphLevels[index]}`
          : await readLevelText(worker, index, fullText);

        const direct = parseDedicatedLevel(levelText);
        const fromCard = parseLevelDirect(fullText);
        const value = direct.locked ? direct.level : fromCard ?? direct.level;
        let level = value == null ? null : {value, quality:glyphLevels[index] ? 0.98 : direct.locked || fromCard === value ? 0.86 : 0.48};
        const small = smallLabels[index];
        const plausibleLevels = small?.levels.filter(c=>c.score>=0.57 && c.score>=small.levels[0].score-.10) || [];
        const glyphSupported=!plausibleLevels.length || plausibleLevels.some(c=>c.value===glyphLevels[index]);
        if ((!glyphLevels[index] || !glyphSupported) && plausibleLevels.length) {
          const top = plausibleLevels[0];
          if (plausibleLevels.some(c=>c.value===value && c.score>=top.score-.045)) level = {value, quality:0.87};
          else if (top.score>=0.76 && top.score-small.levels[1].score>=.045) level={value:top.value,quality:.81};
          else level = {value:top.value, quality:.55};
        }
        const levelConflict = glyphSupported && glyphLevels[index] && fromCard && fromCard !== value
          ? [value, fromCard] : '';
        let limit = await collectLimit(worker, index, fullText, fusedDecision.entry);
        if (small?.blank && !limit) limit = {value:0, quality:.84};
        else if (small && !limit && small.badges[0].score>=.75 && small.badges[0].score-small.badges[1].score>=.017) {
          limit = {value:small.badges[0].value, quality:.83};
        }
        const attackText = await recognizeText(worker, makeAttackCanvas(preview, index), {
          pageMode:'7', whitelist:'0123456789.,KkMmBbTt',
        });
        let attack = window.moncolleConsensus.attackObservation(attackText, fullText);
        if (smallRow && (!attack || attack.quality !== .98)) {
          const reads=[];
          const attempts=[[preview,'loose',worker],[preview,'strict',digitsWorker],[smallRow.local,'loose',worker],
            [smallRow.local,'strict',worker],[smallRow.local,'adaptive',digitsWorker]];
          for(const [source,variant,reader] of attempts) {
            const text=await recognizeText(reader,smallLineCanvas(source,index,'attack',variant),{
              pageMode:'7',whitelist:'0123456789.,KkMmBbTt'});
            const read=window.moncolleConsensus.attackObservation(text,'');
            if(!read || read.value<1000) continue;
            reads.push(read);
            const agreement=reads.filter(r=>r.value===read.value).length>=2;
            if(agreement || read.value===attack?.value || attack?.alternatives?.some(r=>r.value===read.value)) {
              attack={...read,quality:.94}; break;
            }
          }
          if((!attack || attack.quality<.7) && reads.length===1) attack=reads[0];
        }
        const matches = mergeCandidateSources(mergeCatalogMatches([...nameTexts, fullText]), visualDecision?.candidates);
        const names = Object.fromEntries(matches.map(c => [c.entry.id, c.score]));
        if ((visualDecision?.entry?.id === 'jk' || names.jk >= 0.45) && grayscaleCardScore(preview, index) >= 0.90) {
          names.jk = Math.max(names.jk || 0, 0.87);
        }
        if (fusedDecision.accepted) {
          names[fusedDecision.entry.id] = Math.max(names[fusedDecision.entry.id] || 0, fusedDecision.confidence);
        }
        let identity = fusedDecision.accepted && !fusedDecision.conflict && fusedDecision.confidence >= 0.82
          ? fusedDecision.entry.id : '';
        const art=artReads[index];
        const artEntry=art && byName.get(art.name);
        const strongArt=artEntry && art.score>=.47 && art.margin>=.14;
        if (artEntry && (strongArt || (art.score>=.32 && art.margin>=.09 && (!identity || identity===artEntry.id)))) {
          names[artEntry.id]=Math.max(names[artEntry.id]||0,strongArt ? .96 : .75);
          if(strongArt && !identity) identity=artEntry.id;
        }
        const alternateLevels=small?.levels.filter(c=>c.score>=.54 && c.score>=small.levels[0].score-.16 &&
          String(c.value).length===String(small.levels[0].value).length &&
          [...String(c.value)].filter((d,i)=>d!==String(small.levels[0].value)[i]).length<=1) || [];
        const observation = {names, identity, level, levelConflict, limit, attack, plausibleLevels, alternateLevels, artId:strongArt?artEntry.id:'',
          mutations:observationsForMutation(nameTexts, fullText, index)};
        recognized.push({observation});
      }
      reconcileParty();
      renderResults();
      setStatus('解析しました。要確認の枠は、候補と画像を見比べて選べます。');
    } catch (error) {
      console.error(error);
      setStatus('解析に失敗しました：{0}', error.message);
    } finally {
      analyzeButton.disabled = false;
    }
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      sourceImage = await loadImage(file);
      workspace.hidden = false;
      resultsBox.hidden = true;
      analyzeButton.disabled = false;
      resetCrop();
      setStatus(effectiveMode() === 'party'
        ? '編成部分として判定しました。このまま解析できます。'
        : 'バッグ全体として判定しました。解析時に編成部分の位置を自動補正します。');
    } catch (error) {
      sourceImage = null;
      analyzeButton.disabled = true;
      setStatus(error.message);
    }
  });

  modeInput.addEventListener('change', () => {
    if (!sourceImage) return;
    resultsBox.hidden = true;
    resetCrop();
    setStatus('画像の種類を変更しました。プレビューを確認してください。');
  });

  Object.values(cropInputs).forEach(input => {
    input.addEventListener('input', () => {
      if (!sourceImage) return;
      resultsBox.hidden = true;
      cropWasAdjusted = true;
      autoCropRefined = false;
      drawPreview();
    });
  });

  autoCropButton?.addEventListener('click', async () => {
    if (!sourceImage) return;
    resultsBox.hidden = true;
    cropWasAdjusted = false;
    autoCropRefined = false;
    if (effectiveMode() === 'party') {
      resetCrop();
      setStatus('編成部分のみの画像なので、画像全体を使用します。');
      return;
    }
    autoCropButton.disabled = true;
    analyzeButton.disabled = true;
    setStatus('画像モデルで編成部分を自動検出しています…');
    try {
      await refineAutomaticCrop();
      setStatus('編成部分を自動で切り取りました。プレビューを確認して解析してください。');
    } catch (error) {
      console.error(error);
      setCropValues(suggestedCropValues());
      drawPreview();
      setStatus('位置補正を完了できなかったため、標準位置で切り取りました。必要なら範囲を調整してください。');
    } finally {
      autoCropButton.disabled = false;
      analyzeButton.disabled = false;
    }
  });

  analyzeButton.addEventListener('click', analyzeImage);
  applyButton.addEventListener('click', () => {
    const items = recognized.map(item => readyToApply(item) ? item : {catalogId:''});
    const count = items.filter(item => item.catalogId).length;
    if (!count) return;
    api.applyImportedParty(items);
    setStatus('選択済みの{0}体を元の枠に反映しました。{1}', count, count < 7 ? '要確認の枠は元の編成のままです。' : '');
  });

  window.addEventListener('pagehide', () => {
    if (ocrWorker) ocrWorker.terminate();
    if (numericWorker) numericWorker.terminate();
  }, { once: true });
}
