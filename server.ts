import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const STORAGE_FILE = path.join(process.cwd(), 'cloud_db.json');
const MEDIA_DIR = path.join(process.cwd(), 'cloud_media');
const SRV_MEDIA_PREFIX = '__srvmedia__:';

function ensureMediaDir() {
  try {
    if (!fs.existsSync(MEDIA_DIR)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }
  } catch {}
}

function userMediaHash(userKey: string): string {
  return crypto.createHash('sha256').update(userKey.toLowerCase()).digest('hex').slice(0, 16);
}

function safeMediaFileBase(userKey: string, mediaId: string): string {
  const uHash = userMediaHash(userKey);
  const cleanId = String(mediaId || '').replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 96);
  return path.join(MEDIA_DIR, `${uHash}__${cleanId}`);
}

function offloadHeavyMediaOnServer(userKey: string, docs: any[]): any[] {
  if (!Array.isArray(docs)) return [];
  ensureMediaDir();
  return docs.map((d: any) => {
    if (!d || !Array.isArray(d.rows)) return d;
    let docChanged = false;
    const nextRows = d.rows.map((r: any, idx: number) => {
      if (!r || typeof r !== 'object') return r;
      let nextRow = r;
      (['image', 'audio', 'pdf'] as const).forEach((kind) => {
        const val = nextRow[kind];
        if (typeof val === 'string' && val.length > 1500000 && !val.startsWith(SRV_MEDIA_PREFIX) && !val.startsWith('__fschunk__:')) {
          const mediaId = `${String(d.id || 'doc').slice(0, 32)}_${String(r.id || `row-${idx}`).slice(0, 32)}_${kind}_${val.length}`;
          const base = safeMediaFileBase(userKey, mediaId);
          try {
            fs.writeFileSync(`${base}.data`, val, 'utf-8');
            if (nextRow === r) nextRow = { ...r };
            nextRow[kind] = `${SRV_MEDIA_PREFIX}${mediaId}`;
            docChanged = true;
          } catch (e) {
            console.error('Error offloading server media:', e);
          }
        }
      });
      return nextRow;
    });
    return docChanged ? { ...d, rows: nextRows } : d;
  });
}

function readCloudDb(): Record<string, any> {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error reading cloud db:", e);
  }
  return {};
}

function writeCloudDb(db: Record<string, any>) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(db), 'utf-8');
  } catch (e) {
    console.error("Error writing cloud db:", e);
  }
}

function getVerifiedUser(req: express.Request): { uid: string; email?: string } | null {
  try {
    const authHeader = req.headers.authorization;
    let token = '';
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.body && req.body.idToken) {
      token = req.body.idToken;
    } else if (req.query && req.query.idToken) {
      token = req.query.idToken as string;
    }

    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);

    // Dynamically resolve projectId
    let resolvedProjId = 'gen-lang-client-0285886461';
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (conf.projectId) resolvedProjId = conf.projectId;
      }
    } catch (e) {}

    // Allow multiple fallback issuers/audiences for maximum resilience
    const allowedIssuers = [
      'https://securetoken.google.com/gen-lang-client-0285886461',
      `https://securetoken.google.com/${resolvedProjId}`
    ];
    const allowedAudiences = [
      'gen-lang-client-0285886461',
      resolvedProjId
    ];

    if (!allowedIssuers.includes(payload.iss)) {
      console.warn('JWT Issuer mismatch:', payload.iss, 'Expected one of:', allowedIssuers);
      return null;
    }
    if (!allowedAudiences.includes(payload.aud)) {
      console.warn('JWT Audience mismatch:', payload.aud, 'Expected one of:', allowedAudiences);
      return null;
    }

    // Support up to 24-hour clock-skew/expiration leeway for persistent sessions in development/sandbox
    if (payload.exp < now - 86400) {
      console.warn('JWT Token expired heavily:', payload.exp, now);
      return null;
    }

    return {
      uid: payload.sub || payload.user_id,
      email: payload.email
    };
  } catch (e) {
    console.error('Error parsing JWT token:', e);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '75mb' }));
  
  // CORS
  app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      if (req.method === 'OPTIONS') {
          return res.status(200).end();
      }
      next();
  });

  // Google Cloud Storage API Endpoints
  app.post('/api/cloud/sync', (req, res) => {
    try {
      // Enforce authentication
      const verified = getVerifiedUser(req);
      if (!verified) {
         return res.status(401).json({ success: false, error: 'Ju lutemi kyçuni me Email/Fjalëkalim ose me Google për të sinkronizuar të dhënat.' });
      }

      const { documents, activeDocId, blueText, secretList, padNotes, pin, gistToken, gistId, customLabels, notesColor, textColorMode, textSize, textWeight, settingsUpdatedAt, trashItems } = req.body;
      const key = (verified.email || verified.uid).toLowerCase();
      const storedDocs = offloadHeavyMediaOnServer(key, Array.isArray(documents) ? documents : []);

      const db = readCloudDb();
      const lastUpdated = new Date().toISOString();
      const resolvedSettingsUpdatedAt = settingsUpdatedAt || db[key]?.settingsUpdatedAt || lastUpdated;
      db[key] = {
        documents: storedDocs,
        activeDocId: activeDocId || null,
        blueText: blueText !== undefined ? blueText : db[key]?.blueText,
        secretList: secretList !== undefined ? secretList : db[key]?.secretList,
        padNotes: Array.isArray(padNotes) ? padNotes : (db[key]?.padNotes || []),
        customLabels: customLabels !== undefined ? customLabels : db[key]?.customLabels,
        trashItems: Array.isArray(trashItems) ? trashItems : (db[key]?.trashItems || []),
        notesColor: notesColor !== undefined ? notesColor : db[key]?.notesColor,
        textColorMode: textColorMode !== undefined ? textColorMode : db[key]?.textColorMode,
        textSize: textSize !== undefined ? textSize : db[key]?.textSize,
        textWeight: textWeight !== undefined ? textWeight : db[key]?.textWeight,
        pin: pin !== undefined ? pin : db[key]?.pin,
        gistToken: gistToken !== undefined ? gistToken : db[key]?.gistToken,
        gistId: gistId !== undefined ? gistId : db[key]?.gistId,
        geminiKey: req.body.geminiKey !== undefined ? req.body.geminiKey : db[key]?.geminiKey,
        settingsUpdatedAt: resolvedSettingsUpdatedAt,
        lastUpdated
      };
      
      // Also keep a complete snapshot history (max 3) stripping oversized >2MB media from older backups to keep disk healthy
      const backupKey = key + '_backups';
      if (!Array.isArray(db[backupKey])) db[backupKey] = [];
      const lightDocsForHistory = (documents || []).map((d: any) => ({
        ...d,
        rows: Array.isArray(d?.rows)
          ? d.rows.map((r: any) => ({
              ...r,
              audio: typeof r?.audio === 'string' && r.audio.length > 2 * 1024 * 1024 ? '' : r?.audio,
              pdf: typeof r?.pdf === 'string' && r.pdf.length > 2 * 1024 * 1024 ? '' : r?.pdf,
            }))
          : [],
      }));
      db[backupKey].unshift({
        timestamp: lastUpdated,
        docCount: (documents || []).length,
        documents: lightDocsForHistory,
        customLabels: db[key].customLabels || [],
        secretList: db[key].secretList || [],
        padNotes: db[key].padNotes || [],
        trashItems: db[key].trashItems || [],
        blueText: db[key].blueText || '',
        notesColor: db[key].notesColor || 'default',
        textColorMode: db[key].textColorMode || 'default'
      });
      if (db[backupKey].length > 3) db[backupKey] = db[backupKey].slice(0, 3);

      writeCloudDb(db);
      return res.json({
        success: true,
        message: 'Dokumentat u sinkronizuan me sukses në Google Cloud Server!',
        lastUpdated,
        settingsUpdatedAt: resolvedSettingsUpdatedAt,
        docCount: (documents || []).length
      });
    } catch (err: any) {
      console.error("Cloud sync error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/cloud/load', (req, res) => {
    try {
      // Enforce authentication
      const verified = getVerifiedUser(req);
      if (!verified) {
         return res.status(401).json({ success: false, error: 'Ju lutemi kyçuni me Email/Fjalëkalim ose me Google për të shkarkuar të dhënat.' });
      }
      const userId = (verified.email || verified.uid).toLowerCase();

      const db = readCloudDb();
      const record = db[userId];
      if (!record || !record.documents) {
        return res.json({ success: true, documents: [], padNotes: record?.padNotes || [], trashItems: record?.trashItems || [], lastUpdated: null });
      }
      return res.json({
        success: true,
        documents: record.documents,
        activeDocId: record.activeDocId,
        blueText: record.blueText,
        secretList: record.secretList,
        padNotes: Array.isArray(record.padNotes) ? record.padNotes : [],
        customLabels: record.customLabels || [],
        trashItems: Array.isArray(record.trashItems) ? record.trashItems : [],
        notesColor: record.notesColor || 'default',
        textColorMode: record.textColorMode || 'default',
        textSize: record.textSize,
        textWeight: record.textWeight,
        pin: record.pin,
        gistToken: record.gistToken,
        gistId: record.gistId,
        geminiKey: record.geminiKey,
        settingsUpdatedAt: record.settingsUpdatedAt || record.lastUpdated || null,
        lastUpdated: record.lastUpdated
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Chunked media upload & download endpoints (bypasses Cloud Run 32 MiB HTTP/1.1 body limits for 10MB-30MB audio)
  app.post('/api/cloud/media/chunk', (req, res) => {
    try {
      const verified = getVerifiedUser(req);
      if (!verified) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const userKey = (verified.email || verified.uid).toLowerCase();
      const { mediaId, chunkIndex, totalChunks, data } = req.body || {};
      const cIdx = Number(chunkIndex);
      const tChunks = Number(totalChunks);
      if (!mediaId || !Number.isInteger(cIdx) || !Number.isInteger(tChunks) || cIdx < 0 || tChunks < 1 || tChunks > 120 || typeof data !== 'string') {
        return res.status(400).json({ success: false, error: 'Invalid media chunk payload' });
      }
      ensureMediaDir();
      const base = safeMediaFileBase(userKey, String(mediaId));
      const finalFile = `${base}.data`;
      if (fs.existsSync(finalFile) && cIdx === 0 && tChunks === 1) {
        fs.writeFileSync(finalFile, data, 'utf-8');
        return res.json({ success: true, completed: true, mediaId });
      }
      const partFile = `${base}.part.${cIdx}`;
      fs.writeFileSync(partFile, data, 'utf-8');

      let allPresent = true;
      for (let i = 0; i < tChunks; i++) {
        if (!fs.existsSync(`${base}.part.${i}`)) {
          allPresent = false;
          break;
        }
      }
      if (allPresent) {
        fs.writeFileSync(finalFile, '', 'utf-8');
        for (let i = 0; i < tChunks; i++) {
          const p = `${base}.part.${i}`;
          fs.appendFileSync(finalFile, fs.readFileSync(p, 'utf-8'), 'utf-8');
          try { fs.unlinkSync(p); } catch {}
        }
        return res.json({ success: true, completed: true, mediaId });
      }
      return res.json({ success: true, completed: false, chunkIndex: cIdx, mediaId });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/cloud/media/:mediaId', (req, res) => {
    try {
      const verified = getVerifiedUser(req);
      if (!verified) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const userKey = (verified.email || verified.uid).toLowerCase();
      const mediaId = String(req.params.mediaId || '');
      const base = safeMediaFileBase(userKey, mediaId);
      const finalFile = `${base}.data`;
      if (!fs.existsSync(finalFile)) {
        return res.status(404).json({ success: false, error: 'Media not found' });
      }
      const fullData = fs.readFileSync(finalFile, 'utf-8');
      const chunkSize = Math.min(4000000, Math.max(500000, Number(req.query.chunkSize) || 2500000));
      const totalChunks = Math.max(1, Math.ceil(fullData.length / chunkSize));
      const chunkIndex = Number(req.query.chunkIndex);
      if (req.query.chunkIndex !== undefined && Number.isInteger(chunkIndex)) {
        if (chunkIndex < 0 || chunkIndex >= totalChunks) {
          return res.status(400).json({ success: false, error: 'Invalid chunkIndex' });
        }
        const slice = fullData.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize);
        return res.json({ success: true, mediaId, chunkIndex, totalChunks, totalLength: fullData.length, data: slice });
      }
      return res.json({ success: true, mediaId, totalChunks, totalLength: fullData.length, data: totalChunks === 1 ? fullData : undefined });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/cloud/status', (req, res) => {
    try {
      // Enforce authentication
      const verified = getVerifiedUser(req);
      if (!verified) {
         return res.status(401).json({ success: false, error: 'Kërkohet autorizim. Ju lutemi kyçuni në llogari.' });
      }
      const userId = (verified.email || verified.uid).toLowerCase();

      const db = readCloudDb();
      const record = db[userId];
      return res.json({
        success: true,
        online: true,
        hasData: !!(record && record.documents && record.documents.length > 0),
        docCount: record?.documents?.length || 0,
        lastUpdated: record?.lastUpdated || null
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Track temporary per-key/per-model cooldowns on 429 quota limits so fallback models respond cleanly
  const modelCooldownUntil = new Map<string, number>();

  // AI API Route handlers
  app.post('/api/ai/chat', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { prompt, documents, activeDocId, image, audio, blueText, secretList, customLabels, userEmail, geminiKey, isBackgroundAutopilot } = req.body;

      // Robust Multi-tier API Key Resolution (supports both AIza... and newer AQ.... keys)
      const isPlaceholderKey = (val: string) => {
        const v = (val || '').trim();
        return !v || v.length < 15 || v === 'MY_GEMINI_API_KEY' || v === 'undefined' || v === 'null' || /\s/.test(v);
      };
      const isSupportedGoogleKeyFormat = (k: string) =>
        k.startsWith('AIza') || k.startsWith('AQ.');

      let apiKey = (geminiKey || '').trim();
      if (isPlaceholderKey(apiKey)) apiKey = '';

      if (!apiKey) {
        const verified = getVerifiedUser(req);
        const activeUserKey = verified ? (verified.email || verified.uid).toLowerCase() : (userEmail || '').trim().toLowerCase();
        if (activeUserKey) {
          const db = readCloudDb();
          if (db[activeUserKey] && db[activeUserKey].geminiKey) {
            const storedKey = String(db[activeUserKey].geminiKey).trim();
            if (!isPlaceholderKey(storedKey)) {
              apiKey = storedKey;
            }
          }
        }
      }

      if (apiKey && !isSupportedGoogleKeyFormat(apiKey)) {
        console.warn(`Ignoring unrecognized API key format: ${apiKey.slice(0, 6)}...`);
        apiKey = '';
      }

      if (!apiKey) {
        const envKey = (process.env.GEMINI_API_KEY || '').trim();
        if (!isPlaceholderKey(envKey)) {
          apiKey = envKey;
        }
      }

      if (!apiKey) {
        return res.status(400).json({ 
          error: 'Çelësi juaj API i Gemini mungon. Ju lutem konfiguroni atë në panelin "Settings > Secrets" të AI Studio ose klikoni ikonën e çelësit (🔑) lart te AI Assistant për të vendosur çelësin tuaj API (AIza... ose AQ...).' 
        });
      }

      let ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const buildCompactDocumentsForAi = (rawDocs: any[], activeId: string, promptStr: string) => {
        if (!Array.isArray(rawDocs)) return [];
        const qLower = String(promptStr || '').toLowerCase();
        const MAX_TOTAL_CHARS = 110000; // ~30k tokens max — stays safely under 250k TPM free-tier limit

        const sumCol = (rowsArr: any[], key: string) => {
          let sum = 0;
          let count = 0;
          let hasEuro = false;
          for (const r of rowsArr) {
            if (r?.status === 'x') continue;
            const original = String(r?.[key] || '').trim();
            if (!original) continue;
            if (/€|\beur\b/i.test(original)) hasEuro = true;
            let clean = original
              .replace(/^(lek[eë]?|all|eur|usd|chf|gbp|€|\$|£)\s*/i, '')
              .replace(/\s*(lek[eë]?|all|eur|usd|chf|gbp|kg|gr|g|mg|l|ml|m|cm|mm|km|cop[eë]?|pcs|€|\$|£)\.?$/i, '')
              .replace(/\s+/g, '');
            if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(clean)) {
              clean = clean.replace(/,/g, '');
            } else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean)) {
              clean = clean.replace(/\./g, '').replace(',', '.');
            } else {
              clean = clean.replace(/,/g, '.');
            }
            if (/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(clean)) {
              const n = Number(clean);
              if (Number.isFinite(n)) {
                sum += n;
                count++;
              }
            }
          }
          if (count === 0) return null;
          const formatted = Number.isInteger(sum) ? String(sum) : String(Number(sum.toFixed(4)));
          return hasEuro ? `${formatted} €` : formatted;
        };

        const compactDoc = (d: any, includeRows: boolean) => {
          const hdrs: string[] = Array.isArray(d?.headers) ? d.headers : [];
          const rawRows: any[] = Array.isArray(d?.rows) ? d.rows : [];
          const filledRows: any[] = [];

          for (const r of rawRows) {
            if (!r || typeof r !== 'object') continue;
            const rowObj: any = { id: r.id };
            if (r.status && r.status !== 'none') rowObj.status = r.status;
            let hasVal = false;
            for (let ci = 0; ci < hdrs.length; ci++) {
              const k = `col${ci + 1}`;
              const val = r[k];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                rowObj[k] = String(val);
                hasVal = true;
              }
            }
            if (hasVal || (r.status && r.status !== 'none')) {
              filledRows.push(rowObj);
            }
          }

          const numericTotals: Record<string, string> = {};
          hdrs.forEach((h, ci) => {
            const tot = sumCol(filledRows, `col${ci + 1}`);
            if (tot !== null) numericTotals[h || `Col ${ci + 1}`] = tot;
          });

          const base: any = {
            id: d.id,
            title: d.title || 'Pa Titull',
            headers: hdrs,
            filledRowsCount: filledRows.length
          };
          if (Array.isArray(d.tags) && d.tags.length > 0) base.tags = d.tags;
          if (Object.keys(numericTotals).length > 0) base.numericTotals = numericTotals;
          if (includeRows) base.rows = filledRows;
          else base.rowsPreview = filledRows.slice(0, 5);
          return base;
        };

        // Prioritize activeDocId and any documents mentioned by title first
        const prioritized = [...rawDocs].sort((a, b) => {
          const aPri = a?.id === activeId ? 2 : (a?.title && qLower.includes(String(a.title).toLowerCase()) ? 1 : 0);
          const bPri = b?.id === activeId ? 2 : (b?.title && qLower.includes(String(b.title).toLowerCase()) ? 1 : 0);
          return bPri - aPri;
        });

        const result: any[] = [];
        let runningChars = 0;
        for (const doc of prioritized) {
          const fullCompact = compactDoc(doc, true);
          const fullLen = JSON.stringify(fullCompact).length;
          if (runningChars + fullLen <= MAX_TOTAL_CHARS || doc?.id === activeId) {
            result.push(fullCompact);
            runningChars += fullLen;
          } else {
            const summaryCompact = compactDoc(doc, false);
            result.push(summaryCompact);
            runningChars += JSON.stringify(summaryCompact).length;
          }
        }
        return result;
      };

      const compactedDocs = buildCompactDocumentsForAi(documents, activeDocId, prompt);
      const compactSecrets = Array.isArray(secretList) ? secretList.slice(0, 100) : [];
      const compactLabels = Array.isArray(customLabels) ? customLabels : [];

      const systemInstruction = `Ti je një asistent AI për një aplikacion Bllok/Notepad, i jepur pas llogaritjeve, analizës inteligjente, matematikës, menaxhimit, hartimit dhe përmbledhjeve të çdo lloji në notebook. Përdoruesi po të jep leje dhe AKSES TË PLOTË për menaxhim, hartim, gjenerim raportesh PDF dhe gjithçka tjetër në bllokun e shënimeve (përfshirë ato manuale, të nënvizuara dhe ato në Cloud për llogarinë ${userEmail || 'genti8319@gmail.com'}).

SHËRBIMET DHE LLOGARITJET QË DUHET TË BËSH:
1. LLOGARITJE DHE STATISTIKA ME DETAJE: Kur përdoruesi kërkon në chat, bëj llogaritje matematike, nxirr raporte, statistika të hollësishme (shuma, mesatare, përqindje, fitime, sasi total, krahasime) bazuar te shënimet dhe tabelat ekzistuese.
2. ANALIZË E MULTIMEDIAS (IMAZHE & PDF): Ti ke akses të plotë për të analizuar imazhet (PNG, JPG, JPEG) dhe dokumentet PDF të ngarkuara nga përdoruesi. Kur përdoruesi ngarkon një imazh apo skedar PDF, analizoji ato me shumë detaj, nxirr tabelat, rreshtat e shënimeve dhe të dhënat e tyre (si kg, arka, emra, sasi, çmim, vlerë), bëj llogaritjet dhe krijo automatikisht një listë shënimesh të re me veprimin "CREATE_DOCUMENT" sipas dokumentit origjinal të ngarkuar!
3. AKSES TE BUTONAT PDF, CSV, TXT: Përdoruesi të lejon të ofrosh butona/veprime specifike për shkarkimin e dokumenteve si PDF, CSV ose TXT pa prekur ose modifikuar asgjë në shënimet e tyre. Për këtë qëllim, shto veprimet përkatëse tek "actions" siç shpjegohet më poshtë.
4. ANALIZË DHE KRIJIM I ETIKETAVE (LABELS / FOLDERS): Ti ke akses të plotë tek etiketat për t'i analizuar, llogaritur apo krijuar etiketa të reja. Nëse përdoruesi kërkon të krijojë etiketa të reja, propozo veprimin "ADD_LABELS" me një listë të emrave të etiketave të reja. KUJDES: Ti mund vetëm të SHTOSH etiketa të reja, dhe ËSHTË E NDALUAR RREPTËSISHT të zëvendësosh ose të fshish etiketat ekzistuese (kujdes jo të zëvendësosh ekzistueset)!
5. GJENERIM I DOKUMENTEVE & ARKIVAVE PDF ME DETAJE ("GENERATE_PDF_REPORT" / "pdfReport"):
   - Kur përdoruesi kërkon PDF, raport PDF, arkiv PDF, ose thotë "më bëj llogari dhe gjenero PDF", "nxjerr raport me detaje në PDF", "përgatit dokument PDF me listat...", ti DUHET të studiosh, analizosh, llogaritësh shumat/totalet/detajet dhe të kthesh një objekt të strukturuar "pdfReport" DHE veprimin "GENERATE_PDF_REPORT" në "actions".
   - "pdfReport" mund të përmbajë:
     * "title": Titulli i qartë i raportit ose arkivës PDF.
     * "subtitle": Përshkrimi/konteksti i shkurtër (p.sh. "Analizë Financiare & Llogaritje").
     * "summary": Teksti i plotë i raportit, shpjegimeve, llogaritjeve dhe konkluzioneve.
     * "metrics": Listë me tregues kryesorë [{ "label": "Emërtimi", "value": "Vlera e llogaritur" }] (p.sh. Totali kg, Vlera totale, Numri i listave, etj.).
     * "documentIds": Array opsionale me ID-të ekzistuese të listave/blloqeve relevante nga "documents" për t'i përfshirë me të gjitha detajet dhe ngjyrat (statuset) e tyre në PDF (ose "includeAllDocuments": true nëse përdoruesi kërkon të gjithë arkivën e detajuar).
     * "sections": Array me tabela/lista analitike të llogaritura nga ti, ku çdo seksion ka: { "heading": "...", "notes": "...", "headers": ["..."], "rows": [{ "cells": ["..."], "status": "none" | "ok" | "blue" | "yellow" | "x" }] }.
   - Ky veprim nuk ndryshon ose fshin asnjë shënim të përdoruesit, por gjeneron direkt arkivën PDF nga chat-i.

Këtu janë të dhënat e dokumenteve aktualë në formatin JSON (vetëm rreshtat me shënime + totalet numerike):
${JSON.stringify(compactedDocs)}

Shënimet Sekrete të përdoruesit (Blue/Secret Editor Text):
${String(blueText || 'Ska shënime').slice(0, 8000)}

Lista e Checklistave Sekrete:
${JSON.stringify(compactSecrets)}

Etiketat (Labels/Folders) ekzistuese të përdoruesit:
${JSON.stringify(compactLabels)}

Dokumenti aktual aktiv që përdoruesi po shikon është me ID: "${activeDocId}". Ofroni përgjigjen duke u bazuar plotësisht në KËTË DOKUMENT (ose në të gjitha dokumentet kur kërkohet analizë/arkiv e përgjithshme).

RREGULLA TË RREPTA TË SIGURISË DHE KUFIZIMET:
1. LEJE DHE KONFIRMIM NË DRITARE NJOFTIMI: Ti nuk mund të fshish apo ndryshosh asgjë direkt pa konfirmimin e përdoruesit. Çdo propozim për krijim, ndryshim apo fshirje DUHET të kthehet si një strukturë "actions" në formatin JSON të specifikuar më poshtë, në mënyrë që të shfaqet në dritaren e njoftimit për konfirmim dhe leje manuale nga përdoruesi.
2. MBROJTJA E PLOTË E KYÇEVE (Jeshile, Blu, Kuqe, Verdhe, Lock):
   - ËSHTË E NDALUAR RREPTËSISHT të ndryshohen, të modifikohen apo të fshihen shënimet, blloqet ose rreshtat që janë të kyçura me statuset: "ok" (Kyç Jeshil), "blue" (Kyç Blu), "yellow" (Kyç Verdhë), "x" (Kyç i Kuq), ose "lock".
   - Këto rreshta/shënime janë VETËM PËR LEXIM (Read-Only) dhe nuk mund të modifikohen apo të fshihen në asnjë mënyrë nga AI.
   - Nëse propozon një veprim "UPDATE_DOCUMENT_ROWS" ose "PROPOSE_COLUMNS_CHANGE", rreshtat origjinalë që kanë statuset "ok", "blue", "yellow", "x", ose "lock" DUHET të mbeten absolutisht të paprekur, të pandryshuar dhe të fshirë në listën e propozuar.
   - Është absolutisht e ndaluar të propozohet veprimi "DELETE_DOCUMENT" për një bllok/dokument që përmban qoftë edhe një rresht/shënim të mbrojtur me këto kyçe (ok, blue, yellow, x, lock).

TI GJITHMONË DUHET TË KTHESH PËRGJIGJEN TËNDE NË FORMATIN JSON SI MË POSHTË:
{
  "text": "Teksti i përgjigjes tënde për përdoruesin (raporti i plotë i llogaritjeve, analizat me detaje, statistikat e nxjerra apo plani i detajuar).",
  "pdfReport": {
    "title": "Titulli i Raportit PDF (vetëm kur përdoruesi kërkon PDF/raport/arkiv)",
    "subtitle": "Nëntitulli",
    "summary": "Përmbledhja dhe llogaritjet e detajuara për PDF",
    "metrics": [
      { "label": "Totali", "value": "0" }
    ],
    "includeAllDocuments": false,
    "documentIds": [],
    "sections": [
      {
        "heading": "Tabela e Detajuar / Llogaritjet",
        "notes": "Shpjegim",
        "headers": ["Kolona 1", "Kolona 2"],
        "rows": [
          { "cells": ["Vlera 1", "Vlera 2"], "status": "none" }
        ]
      }
    ]
  },
  "actions": [
    {
       "type": "GENERATE_PDF_REPORT",
       "title": "Gjenero & Shkarko Raportin PDF",
       "pdfReport": {}
    },
    {
       "type": "CREATE_DOCUMENT",
       "title": "Titulli i bllokut të ri",
       "headers": ["Data", "Emri", "Sasia (kg)", "Cmimi", "Vlera"],
       "columnWidths": [120, 200, 100, 100, 150],
       "rows": [
          { "id": "r-1", "cells": ["2026-08-08", "Emri i shembullit", "10", "5", "50"], "status": "none" }
       ]
    },
    {
       "type": "PROPOSE_COLUMNS_CHANGE",
       "documentId": "id_e_dokumentit_qe_po_ndryshon",
       "newHeaders": ["Data", "Emri", "Sasia (kg)", "Cmimi", "Vlera"],
       "newColumnWidths": [120, 200, 100, 100, 150],
       "newRows": []
    },
    {
       "type": "UPDATE_DOCUMENT_ROWS",
       "documentId": "id_e_dokumentit_qe_po_ndryshon",
       "newRows": []
    },
    {
       "type": "ADD_LABELS",
       "labels": ["Emri i Etiketës së Re 1", "Emri i Etiketës së Re 2"]
    },
    {
       "type": "DELETE_DOCUMENT",
       "documentId": "id_e_dokumentit_qe_duhet_fshire",
       "title": "Titulli i dokumentit të fshirë"
     },
     {
        "type": "EXPORT_PDF",
        "title": "Shkarko Dokumentin si PDF"
     },
     {
        "type": "EXPORT_CSV",
        "title": "Shkarko Dokumentin si CSV"
     },
     {
        "type": "EXPORT_TXT",
        "title": "Shkarko Dokumentin si TXT"
     },
     {
        "type": "EXPORT_ALL_PDF",
        "title": "Shkarko të Gjithë Arkivën si PDF"
     },
     {
        "type": "EXPORT_ALL_CSV",
        "title": "Shkarko të Gjithë Arkivën si CSV"
     },
     {
        "type": "EXPORT_ALL_TXT",
        "title": "Shkarko të Gjithë Arkivën si TXT"
     }
  ]
}
Kthe VETËM JSON të vlefshëm pa koodblock markdown! (Mos vendos veprime tek "actions" ose "pdfReport" nëse përdoruesi nuk i ka kërkuar, por përfshi "pdfReport" dhe "GENERATE_PDF_REPORT" sa herë përdoruesi kërkon PDF, raport të detajuar, llogaritje për arkivim ose eksport dokumenti).`;

      // Use only valid active Gemini models per @google/genai guidelines.
      // Route background autopilot checks to flash-lite so interactive chat preserves 20 RPD quota on gemini-4-hydrogen.
      const baseCandidates = isBackgroundAutopilot
        ? ['gemini-3.1-flash-lite']
        : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
      const keyTag = apiKey.slice(-8);
      const nowMs = Date.now();
      const activeCandidates = baseCandidates.filter(m => (modelCooldownUntil.get(`${keyTag}:${m}`) || 0) <= nowMs);
      const candidateModels = activeCandidates.length > 0 ? activeCandidates : ['gemini-3.1-flash-lite'];
      let lastError: any = null;

      const buildParts = () => {
        const parts: any[] = [{ text: prompt || 'Analizo bllokun tim' }];
        if (image && typeof image === 'string' && image.includes(',')) {
          const b = image.split(',')[1];
          const m = image.split(';')[0].split(':')[1];
          parts.push({ inlineData: { data: b, mimeType: m } });
        }
        if (audio && typeof audio === 'string' && audio.includes(',')) {
          const b = audio.split(',')[1];
          const m = audio.split(';')[0].split(':')[1];
          parts.push({ inlineData: { data: b, mimeType: m } });
        }
        return parts;
      };

      const buildConfig = (modelName: string) => {
        const cfg: any = {
          systemInstruction,
          responseMimeType: 'application/json'
        };
        if (modelName === 'gemini-4-hydrogen') {
          cfg.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        } else if (!modelName.startsWith('gemini-4-')) {
          cfg.temperature = 0.2;
        }
        return cfg;
      };

      const tryCallWithClient = async (client: GoogleGenAI, modelName: string) => {
        const response = await client.models.generateContent({
          model: modelName,
          contents: buildParts(),
          config: buildConfig(modelName)
        });
        let rawText = (response.text || '{}').trim();
        if (rawText.startsWith('```')) {
          rawText = rawText.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim();
        }
        try {
          return JSON.parse(rawText);
        } catch {
          return { text: response.text || 'Analiza u krye me sukses.' };
        }
      };

      for (const modelName of candidateModels) {
        try {
          const parsedResponse = await tryCallWithClient(ai, modelName);
          return res.json(parsedResponse);
        } catch (err: any) {
          const errMsg = (err.message || '').toLowerCase();
          const isApiKeyError =
            errMsg.includes('api key not valid') ||
            errMsg.includes('api_key_invalid') ||
            errMsg.includes('unauthenticated') ||
            errMsg.includes('invalid key') ||
            (errMsg.includes('api key') && !errMsg.includes('quota'));
          const isQuotaErr =
            err?.status === 429 ||
            errMsg.includes('resource_exhausted') ||
            errMsg.includes('quota') ||
            errMsg.includes('rate limit');

          if (isApiKeyError) {
            const fallbackKey = (process.env.GEMINI_API_KEY || '').trim();
            if (!isPlaceholderKey(fallbackKey) && apiKey !== fallbackKey) {
              apiKey = fallbackKey;
              ai = new GoogleGenAI({
                apiKey,
                httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
              });
              try {
                const parsedResponse = await tryCallWithClient(ai, modelName);
                return res.json(parsedResponse);
              } catch (retryErr: any) {
                lastError = retryErr;
                break;
              }
            } else {
              lastError = err;
              break;
            }
          } else if (isQuotaErr) {
            const isDaily = errMsg.includes('per_day') || errMsg.includes('perday') || errMsg.includes('per day');
            const cooldownMs = isDaily ? 30 * 60 * 1000 : 60 * 1000;
            modelCooldownUntil.set(`${apiKey.slice(-8)}:${modelName}`, Date.now() + cooldownMs);
            lastError = err;
            // Silently proceed to next model (e.g. gemini-3.1-flash-lite)
          } else {
            console.warn(`[AI Chat] Model ${modelName} fallback triggered:`, err?.status || errMsg.slice(0, 140));
            lastError = err;
          }
        }
      }

      // If all candidates hit quota on a custom key, try fallback server GEMINI_API_KEY once if different
      const lastErrMsg = String(lastError?.message || '').toLowerCase();
      const hitQuota = lastError?.status === 429 || lastErrMsg.includes('resource_exhausted') || lastErrMsg.includes('quota');
      const fallbackEnvKey = (process.env.GEMINI_API_KEY || '').trim();
      if (hitQuota && !isPlaceholderKey(fallbackEnvKey) && apiKey !== fallbackEnvKey) {
        const fallbackAi = new GoogleGenAI({
          apiKey: fallbackEnvKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        for (const modelName of ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']) {
          try {
            const parsedResponse = await tryCallWithClient(fallbackAi, modelName);
            return res.json(parsedResponse);
          } catch (fbErr: any) {
            lastError = fbErr;
          }
        }
      }

      throw lastError || new Error("Asnjë nga modelet e AI nuk u përgjigj.");
    } catch (err: any) {
      const errMsg = (err.message || '').toLowerCase();
      const isApiKeyError =
        errMsg.includes('api key not valid') ||
        errMsg.includes('api_key_invalid') ||
        errMsg.includes('unauthenticated') ||
        errMsg.includes('invalid key') ||
        (errMsg.includes('api key') && !errMsg.includes('quota'));
      const isQuotaError =
        err?.status === 429 ||
        errMsg.includes('resource_exhausted') ||
        errMsg.includes('quota') ||
        errMsg.includes('rate limit');

      let friendlyMessage = err.message || 'Ndodhi një gabim gjatë komunikimit me AI.';
      if (isApiKeyError) {
        console.log('[AI Chat Info] Gemini API Key is missing or invalid.');
        friendlyMessage = 'Çelësi juaj API i Gemini nuk është i vlefshëm ose mungon. Ju lutem kontrolloni çelësin tuaj në panelin "Settings > Secrets" të AI Studio, ose klikoni ikonën e konfigurimit të çelësit (🔑) lart në këtë dritare chat-i për të vendosur një çelës API personal (AIza... ose AQ...).';
      } else if (isQuotaError) {
        console.log('[AI Chat Info] Gemini API quota exhausted (429).');
        friendlyMessage = 'Kuota (limiti i përdorimit) për këtë çelës Gemini API është tejkaluar (429 RESOURCE_EXHAUSTED). Provoni përsëri pas pak çastesh ose vendosni një çelës me plan të aktivizuar.';
      } else {
        console.log('[AI Chat Info] Unhandled AI request:', err.message || err);
      }

      return res.status(200).json({
        text: isApiKeyError
          ? `⚠️ **${friendlyMessage}**\n\n_Ju mund të krijoni një çelës API të ri plotësisht falas te Google AI Studio duke vizituar [aistudio.google.com](https://aistudio.google.com/)._`
          : `⚠️ **${friendlyMessage}**`
      });
    }
  });

  // JSON 404 Handler for any unhandled /api/ requests
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.originalUrl} nuk u gjet.` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
