// Best-effort, browser-based face matching using face-api.js loaded from CDN.
// Not a certified biometric system; accuracy depends on lighting & camera.
let loadingPromise = null;

const CDN = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js";
const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

function loadScript() {
  return new Promise((resolve, reject) => {
    if (window.faceapi) return resolve(window.faceapi);
    const s = document.createElement("script");
    s.src = CDN;
    s.onload = () => resolve(window.faceapi);
    s.onerror = () => reject(new Error("face-api load failed"));
    document.head.appendChild(s);
  });
}

async function ensureLoaded() {
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const faceapi = await loadScript();
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    return faceapi;
  })().catch((e) => { loadingPromise = null; throw e; });
  return loadingPromise;
}

function imgFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function descriptor(faceapi, dataUrl) {
  const img = await imgFromDataUrl(dataUrl);
  const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
  const det = await faceapi.detectSingleFace(img, opts).withFaceLandmarks().withFaceDescriptor();
  return det ? det.descriptor : null;
}

// Returns { matched, confidence } or null if unavailable / no reference.
export async function matchFaces(referenceDataUrl, liveDataUrl) {
  if (!referenceDataUrl || !liveDataUrl) return null;
  try {
    const faceapi = await Promise.race([
      ensureLoaded(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 12000)),
    ]);
    const [a, b] = await Promise.all([descriptor(faceapi, referenceDataUrl), descriptor(faceapi, liveDataUrl)]);
    if (!a || !b) return { matched: false, confidence: 0, note: "face_not_detected" };
    const dist = faceapi.euclideanDistance(a, b);
    const confidence = Math.max(0, Math.round((1 - dist) * 100));
    return { matched: dist < 0.55, confidence };
  } catch (e) {
    return null; // graceful fallback: selfie still captured
  }
}
