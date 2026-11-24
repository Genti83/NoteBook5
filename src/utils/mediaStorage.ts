// IndexedDB-backed local storage, safe large-file reader, & ObjectURL cache for large media (up to 30MB MP3/M4A/AMR audio)

const DB_NAME = 'notebook3_media_storage_v1';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const DOCS_IDB_KEY = 'grid_notepad_documents_v2';
const DOCS_LS_KEY = 'grid_notepad_documents_v2';
const IDB_MARKER_PREFIX = '__idb_media__:';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openMediaDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbSet(key: string, value: any): Promise<boolean> {
  const db = await openMediaDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function idbGet<T = any>(key: string): Promise<T | null> {
  const db = await openMediaDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function estimateTotalMediaChars(docs: any[]): number {
  if (!Array.isArray(docs)) return 0;
  let total = 0;
  for (const d of docs) {
    if (!d || !Array.isArray(d.rows)) continue;
    for (const r of d.rows) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.image === 'string') total += r.image.length;
      if (typeof r.audio === 'string') total += r.audio.length;
      if (typeof r.pdf === 'string') total += r.pdf.length;
      if (total > 2500000) return total;
    }
  }
  return total;
}

function buildCompactLocalStorageMirror(docs: any[]): any[] {
  if (!Array.isArray(docs)) return [];
  return docs.map((d) => {
    if (!d || !Array.isArray(d.rows)) return d;
    let changed = false;
    const compactRows = d.rows.map((r: any, idx: number) => {
      if (!r || typeof r !== 'object') return r;
      const rowId = String(r.id || `row-${idx}`);
      const img = typeof r.image === 'string' && r.image.length > 80000
        ? `${IDB_MARKER_PREFIX}${d.id}:${rowId}:image`
        : r.image;
      const aud = typeof r.audio === 'string' && r.audio.length > 80000
        ? `${IDB_MARKER_PREFIX}${d.id}:${rowId}:audio`
        : r.audio;
      const pdfVal = typeof r.pdf === 'string' && r.pdf.length > 80000
        ? `${IDB_MARKER_PREFIX}${d.id}:${rowId}:pdf`
        : r.pdf;
      if (img !== r.image || aud !== r.audio || pdfVal !== r.pdf) {
        changed = true;
        return { ...r, image: img, audio: aud, pdf: pdfVal };
      }
      return r;
    });
    return changed ? { ...d, rows: compactRows } : d;
  });
}

/**
 * Saves documents to IndexedDB (supporting up to 30MB+ audio attachments) AND localStorage.
 * Skips doomed full JSON.stringify when heavy media is present, writing a lightweight
 * `__idb_media__:` mirror to localStorage while persisting full payloads in IndexedDB.
 */
export function saveDocsLocalSafe(docs: any[]): void {
  const safeDocs = Array.isArray(docs) ? docs : [];
  void idbSet(DOCS_IDB_KEY, safeDocs);
  const heavy = estimateTotalMediaChars(safeDocs) > 2500000;
  if (!heavy) {
    try {
      localStorage.setItem(DOCS_LS_KEY, JSON.stringify(safeDocs));
      return;
    } catch {
      // Fall through to compact mirror
    }
  }
  try {
    const compact = buildCompactLocalStorageMirror(safeDocs);
    localStorage.setItem(DOCS_LS_KEY, JSON.stringify(compact));
  } catch {
    // IndexedDB still holds the complete documents and audio.
  }
}

export async function saveDocsLocalSafeAsync(docs: any[]): Promise<boolean> {
  const safeDocs = Array.isArray(docs) ? docs : [];
  const ok = await idbSet(DOCS_IDB_KEY, safeDocs);
  const heavy = estimateTotalMediaChars(safeDocs) > 2500000;
  if (!heavy) {
    try {
      localStorage.setItem(DOCS_LS_KEY, JSON.stringify(safeDocs));
      return ok;
    } catch {
      // Fall through to compact mirror
    }
  }
  try {
    const compact = buildCompactLocalStorageMirror(safeDocs);
    localStorage.setItem(DOCS_LS_KEY, JSON.stringify(compact));
  } catch {}
  return ok;
}

export function clearDocsLocalSafe(): void {
  try {
    localStorage.removeItem(DOCS_LS_KEY);
  } catch {}
  void idbSet(DOCS_IDB_KEY, []);
}

export async function loadDocsFromIdb(): Promise<any[] | null> {
  const res = await idbGet<any[]>(DOCS_IDB_KEY);
  return Array.isArray(res) ? res : null;
}

export function hasIdbMediaMarkers(docs: any[]): boolean {
  if (!Array.isArray(docs)) return false;
  return docs.some(
    (d) =>
      Array.isArray(d?.rows) &&
      d.rows.some(
        (r: any) =>
          (typeof r?.image === 'string' && r.image.startsWith(IDB_MARKER_PREFIX)) ||
          (typeof r?.audio === 'string' && r.audio.startsWith(IDB_MARKER_PREFIX)) ||
          (typeof r?.pdf === 'string' && r.pdf.startsWith(IDB_MARKER_PREFIX))
      )
  );
}

/**
 * Reads a large audio File (10MB - 30MB+) reliably on both Desktop browsers and Android WebView.
 * Uses FileReader first, then falls back to chunked file.slice() ArrayBuffer->Base64 encoding
 * (with 3-byte aligned slices) if FileReader struggles on Android content:// URIs.
 */
export async function readAudioFileAsDataUrlSafe(file: File, normalizedMime = 'audio/mpeg'): Promise<string> {
  const normalizeHeader = (raw: string): string => {
    if (!raw) return '';
    if (raw.startsWith('data:application/octet-stream;base64,')) {
      return raw.replace('data:application/octet-stream;base64,', `data:${normalizedMime};base64,`);
    }
    if (raw.startsWith('data:;base64,')) {
      return raw.replace('data:;base64,', `data:${normalizedMime};base64,`);
    }
    return raw;
  };

  try {
    const viaReader = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = String(reader.result || '');
        if (res) resolve(normalizeHeader(res));
        else reject(new Error('Empty FileReader result'));
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
    if (viaReader) return viaReader;
  } catch {
    // Fall back to chunked slice arrayBuffer reading
  }

  // Fallback: chunked read using 3-byte aligned slices (3 * 256 * 1024 = 786,432 bytes per slice)
  const SLICE_BYTES = 786432;
  const b64Parts: string[] = [];
  const totalSize = file.size || 0;
  for (let offset = 0; offset < totalSize; offset += SLICE_BYTES) {
    const end = Math.min(totalSize, offset + SLICE_BYTES);
    const sliceBuf = await file.slice(offset, end).arrayBuffer();
    const bytes = new Uint8Array(sliceBuf);
    let bin = '';
    const subChunk = 32768;
    for (let i = 0; i < bytes.length; i += subChunk) {
      const sub = bytes.subarray(i, i + subChunk);
      bin += String.fromCharCode.apply(null, Array.from(sub));
    }
    b64Parts.push(btoa(bin));
  }
  return `data:${normalizedMime};base64,${b64Parts.join('')}`;
}

export const readFileAsDataUrlSafe = readAudioFileAsDataUrlSafe;

// ObjectURL cache so playing/seeking large (up to 30MB) audio files never stalls WebView
const objectUrlCache = new Map<string, string>();
const MAX_CACHED_OBJECT_URLS = 8;

export function dataUrlToPlayableSrc(dataUrl: string, fallbackMime = 'audio/mpeg'): string {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return dataUrl;
  }
  const existing = objectUrlCache.get(dataUrl);
  if (existing) return existing;

  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return dataUrl;
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/^data:([^;]+)/i);
    let mimeType = mimeMatch ? mimeMatch[1] : fallbackMime;
    if (mimeType === 'application/octet-stream') mimeType = fallbackMime;

    let blob: Blob;
    if (/;base64/i.test(header)) {
      // Decode in 1MB Base64 slices (1,048,576 chars, multiple of 4) to keep peak RAM low on mobile WebView
      const B64_SLICE_LEN = 1048576;
      const parts: BlobPart[] = [];
      for (let offset = 0; offset < body.length; offset += B64_SLICE_LEN) {
        const chunkStr = body.slice(offset, offset + B64_SLICE_LEN);
        const binStr = atob(chunkStr);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }
        parts.push(bytes);
      }
      blob = new Blob(parts, { type: mimeType });
    } else {
      blob = new Blob([decodeURIComponent(body)], { type: mimeType });
    }

    const objUrl = URL.createObjectURL(blob);
    if (objectUrlCache.size >= MAX_CACHED_OBJECT_URLS) {
      const oldestKey = objectUrlCache.keys().next().value;
      if (oldestKey) {
        const oldestUrl = objectUrlCache.get(oldestKey);
        if (oldestUrl) {
          try { URL.revokeObjectURL(oldestUrl); } catch {}
        }
        objectUrlCache.delete(oldestKey);
      }
    }
    objectUrlCache.set(dataUrl, objUrl);
    return objUrl;
  } catch {
    return dataUrl;
  }
}

export function estimateDataUrlSizeBytes(dataUrl: string): number {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return dataUrl.length;
  const body = dataUrl.slice(commaIdx + 1);
  if (/;base64/i.test(dataUrl.slice(0, commaIdx))) {
    const padding = body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((body.length * 3) / 4) - padding);
  }
  return body.length;
}

export function formatBytesReadable(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
