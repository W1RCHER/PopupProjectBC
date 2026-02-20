let ML_WEIGHTS = null;
let LOADED = false;
async function loadWeights() {
  if (LOADED) return;

  try {
    const res = await fetch(chrome.runtime.getURL("ml_weights.json"));
    ML_WEIGHTS = await res.json();
    LOADED = true;
  } catch (e) {
    console.error("Ошибка загрузки ml_weights.json:", e);
    ML_WEIGHTS = null;
  }
}


function extractFeatures(code) {
  return {
    length: code.length,
    evalCount: (code.match(/eval\(/g) || []).length,
    obfuscationRate: (code.match(/\\x[0-9A-F]{2}/gi) || []).length,
    urlCount: (code.match(/https?:\/\//g) || []).length,
    base64: /atob|btoa/.test(code) ? 1 : 0,
    crypto: /CryptoJS|WebAssembly/.test(code) ? 1 : 0,
    iframe: /<iframe/i.test(code) ? 1 : 0,
    htmlInjection: /innerHTML|outerHTML/.test(code) ? 1 : 0
  };
}


function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}


export async function analyzeWithML(code) {
  await loadWeights();

  if (!ML_WEIGHTS) {
    console.warn("No ML weights — using fallback");
    return { risk: 0.25 };
  }

  const x = extractFeatures(code);

  const featuresList = Object.keys(ML_WEIGHTS.weights);
  const mean = ML_WEIGHTS.scaler_mean;
  const scale = ML_WEIGHTS.scaler_scale;

  let z = ML_WEIGHTS.bias;

  featuresList.forEach((f, i) => {
    const raw = x[f] || 0;
    const norm = (raw - mean[i]) / scale[i];
    z += norm * ML_WEIGHTS.weights[f];
  });

  const risk = sigmoid(z);

  return { risk };
}
