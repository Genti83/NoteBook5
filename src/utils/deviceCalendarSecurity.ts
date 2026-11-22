export type CalendarCategory = 'takim' | 'shenim' | 'pune' | 'personal' | 'emergjent';
export type BuiltInAlarmTone = 'classic' | 'chime' | 'urgent' | 'gentle';
export type CalendarAlarmTone = BuiltInAlarmTone | `custom:${string}`;
export type CalendarRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CustomAlarmAudioMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD (device local date)
  time: string; // HH:MM (24h device local time)
  title: string;
  notes: string;
  category: CalendarCategory;
  alarmEnabled: boolean;
  alarmMinutesBefore: number;
  alarmTone: CalendarAlarmTone;
  repeat: CalendarRepeat;
  completed: boolean;
  linkedDocId?: string | null;
  notifiedInstances?: string[];
  snoozedUntil?: number | null;
  createdAt: number;
}

export const ALBANIAN_MONTHS = [
  'Janar', 'Shkurt', 'Mars', 'Prill', 'Maj', 'Qershor',
  'Korrik', 'Gusht', 'Shtator', 'Tetor', 'Nëntor', 'Dhjetor'
];

export const ENGLISH_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const GREEK_MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'
];

export const ALBANIAN_WEEKDAYS_FULL = [
  'E Diel', 'E Hënë', 'E Martë', 'E Mërkurë', 'E Enjte', 'E Premte', 'E Shtunë'
];

export const ENGLISH_WEEKDAYS_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export const GREEK_WEEKDAYS_FULL = [
  'Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'
];

export const ALBANIAN_WEEKDAYS_MON_SHORT = [
  'Hë', 'Ma', 'Më', 'En', 'Pr', 'Sh', 'Di'
];

export const ENGLISH_WEEKDAYS_MON_SHORT = [
  'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'
];

export const GREEK_WEEKDAYS_MON_SHORT = [
  'Δε', 'Τρ', 'Τε', 'Πε', 'Πα', 'Σα', 'Κυ'
];

export function getCalendarLocale(lang: 'sq' | 'en' | 'el' = 'sq') {
  if (lang === 'en') {
    return { months: ENGLISH_MONTHS, weekdaysFull: ENGLISH_WEEKDAYS_FULL, weekdaysMonShort: ENGLISH_WEEKDAYS_MON_SHORT };
  }
  if (lang === 'el') {
    return { months: GREEK_MONTHS, weekdaysFull: GREEK_WEEKDAYS_FULL, weekdaysMonShort: GREEK_WEEKDAYS_MON_SHORT };
  }
  return { months: ALBANIAN_MONTHS, weekdaysFull: ALBANIAN_WEEKDAYS_FULL, weekdaysMonShort: ALBANIAN_WEEKDAYS_MON_SHORT };
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function getLocalYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function getLocalHm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function getLocalHms(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((v) => parseInt(v, 10));
  return new Date(y || 2026, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function eventMatchesDate(ev: CalendarEvent, targetYmd: string): boolean {
  if (!ev.date || !targetYmd) return false;
  if (ev.date === targetYmd) return true;
  if (ev.repeat === 'none') return false;
  if (targetYmd < ev.date) return false;

  const start = parseLocalYmd(ev.date);
  const target = parseLocalYmd(targetYmd);

  switch (ev.repeat) {
    case 'daily':
      return true;
    case 'weekly':
      return start.getDay() === target.getDay();
    case 'monthly':
      return start.getDate() === target.getDate();
    case 'yearly':
      return start.getDate() === target.getDate() && start.getMonth() === target.getMonth();
    default:
      return false;
  }
}

function escapeIcsText(val: string): string {
  return String(val || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatIcsLocalDateTime(ymd: string, hm: string): string {
  const cleanDate = ymd.replace(/-/g, '');
  const [hh, mm] = (hm || '09:00').split(':');
  return `${cleanDate}T${pad2(parseInt(hh || '9', 10))}${pad2(parseInt(mm || '0', 10))}00`;
}

export function generateEventsIcs(events: CalendarEvent[], lang: 'sq' | 'en' | 'el' = 'sq'): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;
  const prodId = lang === 'en'
    ? 'PRODID:-//NoteBook3//Personal Calendar//EN'
    : lang === 'el'
      ? 'PRODID:-//NoteBook3//Prosopiko Imerologio//EL'
      : 'PRODID:-//NoteBook3//Kalendari Personal//SQ';
  const defaultAppointment = lang === 'en' ? 'NoteBook3 Appointment' : lang === 'el' ? 'Ραντεβού NoteBook3' : 'Takim NoteBook3';
  const defaultReminder = lang === 'en' ? 'NoteBook3 Reminder' : lang === 'el' ? 'Υπενθύμιση NoteBook3' : 'Zile Takimi NoteBook3';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    prodId,
    'CALSCALE:GREGORIAN',
  ];

  for (const ev of events) {
    const dtStart = formatIcsLocalDateTime(ev.date, ev.time || '09:00');
    const [sh, sm] = (ev.time || '09:00').split(':').map((n) => parseInt(n, 10));
    const endDate = parseLocalYmd(ev.date);
    endDate.setHours(sh || 9, (sm || 0) + 30, 0, 0);
    const dtEnd = `${endDate.getFullYear()}${pad2(endDate.getMonth() + 1)}${pad2(endDate.getDate())}T${pad2(endDate.getHours())}${pad2(endDate.getMinutes())}00`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${ev.id}@notebook3.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`DTEND:${dtEnd}`);
    lines.push(`SUMMARY:${escapeIcsText(ev.title || defaultAppointment)}`);
    if (ev.notes) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.notes)}`);
    }
    if (ev.repeat && ev.repeat !== 'none') {
      const rruleMap: Record<string, string> = {
        daily: 'DAILY',
        weekly: 'WEEKLY',
        monthly: 'MONTHLY',
        yearly: 'YEARLY',
      };
      if (rruleMap[ev.repeat]) {
        lines.push(`RRULE:FREQ=${rruleMap[ev.repeat]}`);
      }
    }
    if (ev.alarmEnabled) {
      const mins = Math.max(0, ev.alarmMinutesBefore || 0);
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${mins}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeIcsText(ev.title || defaultReminder)}`);
      lines.push('END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function downloadIcsFile(content: string, filename: string): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const base64Data = btoa(unescape(encodeURIComponent(content)));
      try {
        const { SaveAs } = await import('capacitor-save-as');
        await SaveAs.showSaveAsPicker({
          filename,
          mimeType: 'text/calendar',
          data: base64Data,
        });
        return;
      } catch (safErr: any) {
        const msg = String(safErr?.message || safErr || '').toLowerCase();
        if (msg.includes('cancel') || msg.includes('abort')) return;
      }
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });
      await Share.share({
        title: filename,
        url: writeResult.uri,
        dialogTitle: filename,
      });
      return;
    }
  } catch {
    // Fallback to browser Blob download below
  }

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const CUSTOM_RINGTONES_META_KEY = 'grid_notepad_custom_ringtones_v1';
const NB3_AUDIO_DB_NAME = 'nb3_calendar_audio_db';
const NB3_AUDIO_STORE_NAME = 'audios';

export function listCustomAlarmAudios(): CustomAlarmAudioMeta[] {
  try {
    const raw = localStorage.getItem(CUSTOM_RINGTONES_META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomAlarmAudioList(list: CustomAlarmAudioMeta[]): void {
  try {
    localStorage.setItem(CUSTOM_RINGTONES_META_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(NB3_AUDIO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(NB3_AUDIO_STORE_NAME)) {
        db.createObjectStore(NB3_AUDIO_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open audio DB'));
  });
}

export async function saveCustomAlarmAudioFile(file: File): Promise<CustomAlarmAudioMeta> {
  const id = `song_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanName = (file.name || 'Audio').replace(/\.[^/.]+$/, '').slice(0, 48) || 'Audio';
  const meta: CustomAlarmAudioMeta = {
    id,
    name: cleanName,
    mimeType: file.type || 'audio/mpeg',
    size: file.size || 0,
    createdAt: Date.now(),
  };

  try {
    const db = await openAudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(NB3_AUDIO_STORE_NAME, 'readwrite');
      tx.objectStore(NB3_AUDIO_STORE_NAME).put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to store audio'));
    });
    db.close();
  } catch {
    // Fallback: data URL stored directly if IndexedDB fails in restricted mode
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsDataURL(file);
    });
    if (dataUrl) {
      localStorage.setItem(`nb3_audio_fallback_${id}`, dataUrl);
    }
  }

  const next = [meta, ...listCustomAlarmAudios()];
  saveCustomAlarmAudioList(next);
  return meta;
}

export async function deleteCustomAlarmAudio(id: string): Promise<CustomAlarmAudioMeta[]> {
  try {
    localStorage.removeItem(`nb3_audio_fallback_${id}`);
    if (typeof indexedDB !== 'undefined') {
      const db = await openAudioDb();
      await new Promise<void>((resolve) => {
        const tx = db.transaction(NB3_AUDIO_STORE_NAME, 'readwrite');
        tx.objectStore(NB3_AUDIO_STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      db.close();
    }
  } catch {
    // ignore cleanup error
  }
  const next = listCustomAlarmAudios().filter((item) => item.id !== id);
  saveCustomAlarmAudioList(next);
  return next;
}

async function getCustomAlarmAudioUrl(id: string): Promise<string | null> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const db = await openAudioDb();
      const blob = await new Promise<Blob | null>((resolve) => {
        const tx = db.transaction(NB3_AUDIO_STORE_NAME, 'readonly');
        const req = tx.objectStore(NB3_AUDIO_STORE_NAME).get(id);
        req.onsuccess = () => resolve((req.result as Blob) || null);
        req.onerror = () => resolve(null);
      });
      db.close();
      if (blob) {
        return URL.createObjectURL(blob);
      }
    }
  } catch {
    // fallback below
  }
  const fallback = localStorage.getItem(`nb3_audio_fallback_${id}`);
  return fallback || null;
}

let sharedAlarmAudioCtx: AudioContext | null = null;
let activeCustomAudioEl: HTMLAudioElement | null = null;
let activeCustomAudioUrl: string | null = null;

export function stopCalendarAlarmTone(): void {
  if (activeCustomAudioEl) {
    try {
      activeCustomAudioEl.pause();
      activeCustomAudioEl.currentTime = 0;
    } catch {}
    activeCustomAudioEl = null;
  }
  if (activeCustomAudioUrl && activeCustomAudioUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(activeCustomAudioUrl);
    } catch {}
  }
  activeCustomAudioUrl = null;
}

function playSynthAlarmPattern(tone: BuiltInAlarmTone = 'classic'): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedAlarmAudioCtx) {
      sharedAlarmAudioCtx = new AudioCtx();
    }
    const ctx = sharedAlarmAudioCtx;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const patterns: Record<BuiltInAlarmTone, { freqs: number[]; step: number; dur: number; type: OscillatorType }> = {
      classic: { freqs: [880, 1174.66, 880, 1174.66], step: 0.16, dur: 0.13, type: 'triangle' },
      chime: { freqs: [523.25, 659.25, 783.99, 1046.5], step: 0.15, dur: 0.25, type: 'sine' },
      urgent: { freqs: [987.77, 1318.51, 987.77, 1318.51, 1567.98], step: 0.11, dur: 0.09, type: 'square' },
      gentle: { freqs: [440, 554.37, 659.25], step: 0.22, dur: 0.35, type: 'sine' },
    };

    const p = patterns[tone] || patterns.classic;
    const base = ctx.currentTime;
    p.freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = p.type;
      osc.frequency.setValueAtTime(freq, base + idx * p.step);

      const start = base + idx * p.step;
      const peak = tone === 'urgent' ? 0.16 : 0.22;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + p.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + p.dur + 0.02);
    });
  } catch {
    // Ignore audio context restriction errors before user gesture
  }
}

export async function playCalendarAlarmTone(
  tone: CalendarAlarmTone = 'classic',
  options?: { loop?: boolean; onEnded?: () => void }
): Promise<boolean> {
  stopCalendarAlarmTone();
  if (typeof tone === 'string' && tone.startsWith('custom:')) {
    const id = tone.slice(7);
    try {
      const audioUrl = await getCustomAlarmAudioUrl(id);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.loop = Boolean(options?.loop);
        audio.volume = 0.95;
        activeCustomAudioEl = audio;
        activeCustomAudioUrl = audioUrl;
        audio.onended = () => {
          if (!audio.loop) {
            stopCalendarAlarmTone();
            options?.onEnded?.();
          }
        };
        await audio.play();
        return true;
      }
    } catch {
      stopCalendarAlarmTone();
    }
    playSynthAlarmPattern('classic');
    return false;
  }

  playSynthAlarmPattern((tone as BuiltInAlarmTone) || 'classic');
  return true;
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

const DEVICE_WEBAUTHN_CRED_KEY = 'grid_notepad_device_cred_id';

export interface DeviceSecurityVerifyResult {
  verified: boolean;
  method: string;
  reason?: 'cancelled' | 'unsupported' | 'blocked';
  message: string;
}

export async function requestPhoneDeviceSecurityVerification(lang: 'sq' | 'en' | 'el' = 'sq'): Promise<DeviceSecurityVerifyResult> {
  const elMap: Record<string, string> = {
    'Android Device Security': 'Ασφάλεια Συσκευής Android',
    'Device security verification timed out.': 'Έληξε ο χρόνος επαλήθευσης ασφαλείας συσκευής.',
    'Phone Security (PIN / Fingerprint / Pattern)': 'Ασφάλεια Τηλεφώνου (PIN / Αποτύπωμα / Μοτίβο)',
    'Identity verified successfully by phone system.': 'Η ταυτότητα επαληθεύτηκε επιτυχώς από το σύστημα του τηλεφώνου.',
    'This phone does not have a lock screen (PIN / Password / Pattern / Biometric) enabled in Android Settings.': 'Αυτό το τηλέφωνο δεν έχει ενεργό κλείδωμα οθόνης (PIN / Κωδικό / Μοτίβο / Βιομετρικό) στις Ρυθμίσεις Android.',
    'Phone device security verification was cancelled.': 'Η επαλήθευση ασφαλείας του τηλεφώνου ακυρώθηκε.',
    'NoteBook3 Device Security': 'Ασφάλεια Συσκευής NoteBook3',
    'Enter phone PIN, Password, Pattern or Fingerprint to view keys': 'Εισαγάγετε PIN, Κωδικό, Μοτίβο ή Αποτύπωμα τηλεφώνου για προβολή κλειδιών',
    'No active phone screen lock (PIN / Password / Pattern) found on Android.': 'Δεν βρέθηκε ενεργό κλείδωμα οθόνης (PIN / Κωδικός / Μοτίβο) στο Android.',
    'Verify phone device security (PIN, Password, Fingerprint or Pattern) to reveal NoteBook3 keys': 'Επαληθεύστε την ασφάλεια τηλεφώνου (PIN, Κωδικό, Αποτύπωμα ή Μοτίβο) για προβολή κλειδιών NoteBook3',
    'Device lock permission required': 'Απαιτείται άδεια κλειδώματος συσκευής',
    'Native Phone Security (Biometric / PIN / Pattern)': 'Εγγενής Ασφάλεια Τηλεφώνου (Βιομετρικό / PIN / Μοτίβο)',
    'Verify device lock to view NoteBook3 keys': 'Επαληθεύστε το κλείδωμα συσκευής για προβολή κλειδιών NoteBook3',
    'Native Device Security': 'Εγγενής Ασφάλεια Συσκευής',
    'Identity verified successfully.': 'Η ταυτότητα επαληθεύτηκε επιτυχώς.',
    'Device security verification was cancelled by the user.': 'Η επαλήθευση ασφαλείας συσκευής ακυρώθηκε από τον χρήστη.',
    'This browser or environment does not support WebAuthn device security.': 'Αυτό το πρόγραμμα περιήγησης δεν υποστηρίζει ασφάλεια συσκευής WebAuthn.',
    'No local platform authenticator (PIN / Password / Fingerprint / Pattern) is available in this browser.': 'Δεν υπάρχει διαθέσιμος τοπικός επαληθευτής (PIN / Κωδικός / Αποτύπωμα / Μοτίβο) σε αυτό το πρόγραμμα περιήγησης.',
    'Phone System Lock (PIN / Password / Finger / Pattern)': 'Κλείδωμα Συστήματος Τηλεφώνου (PIN / Κωδικός / Αποτύπωμα / Μοτίβο)',
    'Phone security permission approved!': 'Η άδεια ασφαλείας τηλεφώνου εγκρίθηκε!',
    'The current iframe/preview environment blocks the direct OS security prompt.': 'Το τρέχον πλαίσιο προεπισκόπησης μπλοκάρει το άμεσο παράθυρο ασφαλείας OS.',
    'The preview iframe blocks the OS security dialog.': 'Το πλαίσιο προεπισκόπησης μπλοκάρει το παράθυρο ασφαλείας OS.',
    'Phone Lock': 'Κλείδωμα Τηλεφώνου',
    'Security request was denied or closed. Try again or use device lock type verification.': 'Το αίτημα ασφαλείας απορρίφθηκε ή έκλεισε. Δοκιμάστε ξανά ή επιλέξτε τύπο κλειδώματος.',
    'NoteBook3 Owner': 'Κάτοχος NoteBook3',
    'Phone security permission verified successfully!': 'Η άδεια ασφαλείας τηλεφώνου επαληθεύτηκε επιτυχώς!',
    'Verification was not completed.': 'Η επαλήθευση δεν ολοκληρώθηκε.',
    'Browser/iframe security restriction for OS prompt.': 'Περιορισμός ασφαλείας προγράμματος περιήγησης για ερώτηση OS.',
    'Security request was cancelled or timed out.': 'Το αίτημα ασφαλείας ακυρώθηκε ή έληξε.',
    'System could not open the security prompt.': 'Το σύστημα δεν μπόρεσε να ανοίξει το παράθυρο ασφαλείας.',
  };
  const tr = (sq: string, en: string) => (lang === 'en' ? en : lang === 'el' ? (elMap[en] || en) : sq);
  // 1. Check built-in NoteBook3 Android NB3Device bridge (BiometricPrompt + KeyguardManager PIN/Pattern/Password)
  try {
    const win: any = window;
    if (win?.NB3Device && typeof win.NB3Device.verifyDeviceSecurity === 'function') {
      const bridgeResult = await new Promise<DeviceSecurityVerifyResult>((resolve) => {
        let settled = false;
        const finish = (res: DeviceSecurityVerifyResult) => {
          if (settled) return;
          settled = true;
          window.removeEventListener('nb3-device-security', onSecEvent);
          clearTimeout(timer);
          resolve(res);
        };
        const timer = setTimeout(() => {
          finish({
            verified: false,
            method: tr('Siguria e Telefonit Android', 'Android Device Security'),
            reason: 'cancelled',
            message: tr('Koha e verifikimit të sigurisë skadoi.', 'Device security verification timed out.'),
          });
        }, 65000);
        const onSecEvent = (ev: Event) => {
          const detail = (ev as CustomEvent<{ verified?: boolean; cancelled?: boolean; noLock?: boolean; method?: string }>).detail || {};
          if (detail.verified) {
            finish({
              verified: true,
              method: detail.method || tr('Siguria e Telefonit (PIN / Gjurmë / Pattern)', 'Phone Security (PIN / Fingerprint / Pattern)'),
              message: tr('Identiteti u verifikua me sukses nga sistemi i telefonit.', 'Identity verified successfully by phone system.'),
            });
          } else if (detail.noLock) {
            finish({
              verified: false,
              method: 'Android Lock',
              reason: 'unsupported',
              message: tr('Ky telefon nuk ka aktivizuar një kyç sigurie (PIN / Password / Pattern / Gjurmë) te Cilësimet e Android.', 'This phone does not have a lock screen (PIN / Password / Pattern / Biometric) enabled in Android Settings.'),
            });
          } else {
            finish({
              verified: false,
              method: detail.method || 'Android Lock',
              reason: 'cancelled',
              message: tr('Verifikimi i sigurisë së telefonit u anulua.', 'Phone device security verification was cancelled.'),
            });
          }
        };
        window.addEventListener('nb3-device-security', onSecEvent);
        const started = win.NB3Device.verifyDeviceSecurity(
          tr('Siguria e Pajisjes NoteBook3', 'NoteBook3 Device Security'),
          tr('Vendosni PIN, Password, Pattern ose Gjurmën e telefonit për të parë kyçat', 'Enter phone PIN, Password, Pattern or Fingerprint to view keys')
        );
        if (!started) {
          // If no device lock is set, let onSecEvent resolve or timeout fast
          setTimeout(() => {
            finish({
              verified: false,
              method: 'Android Lock',
              reason: 'unsupported',
              message: tr('Telefoni nuk ka kyç ekrani (PIN / Password / Pattern) aktiv në Android.', 'No active phone screen lock (PIN / Password / Pattern) found on Android.'),
            });
          }, 400);
        }
      });
      return bridgeResult;
    }

    const capPlugins = win?.Capacitor?.Plugins;
    if (capPlugins?.NativeBiometric?.verifyIdentity) {
      await capPlugins.NativeBiometric.verifyIdentity({
        reason: tr('Verifikoni sigurinë e telefonit (PIN, Password, Gjurmë Gishti ose Pattern) për të hapur kyçat e NoteBook3', 'Verify phone device security (PIN, Password, Fingerprint or Pattern) to reveal NoteBook3 keys'),
        title: tr('Siguria e Pajisjes NoteBook3', 'NoteBook3 Device Security'),
        subtitle: tr('Kërkohet leja e kyçit të telefonit', 'Device lock permission required'),
        useFallback: true,
      });
      return {
        verified: true,
        method: tr('Siguria Native e Telefonit (Biometri / PIN / Pattern)', 'Native Phone Security (Biometric / PIN / Pattern)'),
        message: tr('Identiteti u verifikua me sukses nga sistemi i telefonit.', 'Identity verified successfully by phone system.'),
      };
    }
    if (capPlugins?.BiometricAuth?.authenticate) {
      await capPlugins.BiometricAuth.authenticate({
        reason: tr('Verifikoni kyçin e telefonit për të parë kyçat e NoteBook3', 'Verify device lock to view NoteBook3 keys'),
        allowDeviceCredential: true,
      });
      return {
        verified: true,
        method: tr('Siguria Native e Pajisjes', 'Native Device Security'),
        message: tr('Identiteti u verifikua me sukses nga sistemi i telefonit.', 'Identity verified successfully by phone system.'),
      };
    }
    if (typeof win?.AndroidBiometric?.authenticate === 'function') {
      const ok = await win.AndroidBiometric.authenticate();
      if (ok) {
        return {
          verified: true,
          method: 'Android Device Lock',
          message: tr('Identiteti u verifikua me sukses.', 'Identity verified successfully.'),
        };
      }
    }
  } catch (nativeErr: any) {
    const msg = String(nativeErr?.message || nativeErr || '');
    if (/cancel|abort|dismiss/i.test(msg)) {
      return {
        verified: false,
        method: 'Native Lock',
        reason: 'cancelled',
        message: tr('Verifikimi i sigurisë së telefonit u anulua nga përdoruesi.', 'Device security verification was cancelled by the user.'),
      };
    }
  }

  // 2. Standard WebAuthn Platform Authenticator (triggers OS PIN / Password / Fingerprint / Face / Pattern)
  const hasWebAuthn =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.credentials);

  if (!hasWebAuthn) {
    return {
      verified: false,
      method: 'Browser',
      reason: 'unsupported',
      message: tr('Ky shfletues ose mjedis nuk mbështet WebAuthn të sigurisë së pajisjes.', 'This browser or environment does not support WebAuthn device security.'),
    };
  }

  try {
    const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      return {
        verified: false,
        method: 'Platform Authenticator',
        reason: 'unsupported',
        message: tr('Pajisja nuk ka aktivizuar një verifikues lokal (PIN / Password / Gjurmë / Pattern) në këtë shfletues.', 'No local platform authenticator (PIN / Password / Fingerprint / Pattern) is available in this browser.'),
      };
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const savedCredB64 = localStorage.getItem(DEVICE_WEBAUTHN_CRED_KEY);

    if (savedCredB64) {
      try {
        const allowId = base64ToBuffer(savedCredB64);
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [{ id: allowId, type: 'public-key', transports: ['internal'] }],
            userVerification: 'required',
            timeout: 60000,
          },
        });
        if (assertion) {
          return {
            verified: true,
            method: tr('Kyçi i Sistemit të Telefonit (PIN / Password / Finger / Pattern)', 'Phone System Lock (PIN / Password / Finger / Pattern)'),
            message: tr('Leja e sigurisë së telefonit u aprovua!', 'Phone security permission approved!'),
          };
        }
      } catch (getErr: any) {
        if (getErr?.name === 'SecurityError') {
          return {
            verified: false,
            method: 'WebAuthn',
            reason: 'blocked',
            message: tr('Mjedisi aktual (iframe/preview) bllokon dritaren direkte të sigurisë së telefonit.', 'The current iframe/preview environment blocks the direct OS security prompt.'),
          };
        }
        if (getErr?.name === 'NotAllowedError') {
          if (window.self !== window.top) {
            return {
              verified: false,
              method: 'WebAuthn',
              reason: 'blocked',
              message: tr('Shfletuesi në preview iframe bllokon dritaren e sigurisë së OS-it.', 'The preview iframe blocks the OS security dialog.'),
            };
          }
          return {
            verified: false,
            method: tr('Kyçi i Telefonit', 'Phone Lock'),
            reason: 'cancelled',
            message: tr('Kërkesa e sigurisë u refuzua ose u mbyll. Provoni përsëri ose përdorni verifikimin e llojit të kyçit.', 'Security request was denied or closed. Try again or use device lock type verification.'),
          };
        }
        localStorage.removeItem(DEVICE_WEBAUTHN_CRED_KEY);
      }
    }

    const userId = crypto.getRandomValues(new Uint8Array(16));
    const created = (await navigator.credentials.create({
      publicKey: {
        rp: { name: 'NoteBook3 Security' },
        user: {
          id: userId,
          name: 'notebook3-device-owner',
          displayName: tr('Pronari i NoteBook3', 'NoteBook3 Owner'),
        },
        challenge,
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          residentKey: 'preferred',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (created && created.rawId) {
      localStorage.setItem(DEVICE_WEBAUTHN_CRED_KEY, bufferToBase64(created.rawId));
      return {
        verified: true,
        method: tr('Kyçi i Sistemit të Telefonit (PIN / Password / Finger / Pattern)', 'Phone System Lock (PIN / Password / Finger / Pattern)'),
        message: tr('Leja e sigurisë së telefonit u verifikua me sukses!', 'Phone security permission verified successfully!'),
      };
    }

    return {
      verified: false,
      method: tr('Kyçi i Telefonit', 'Phone Lock'),
      reason: 'cancelled',
      message: tr('Verifikimi nuk u përfundua.', 'Verification was not completed.'),
    };
  } catch (err: any) {
    const name = String(err?.name || '');
    const msg = String(err?.message || err || '');
    if (name === 'SecurityError' || window.self !== window.top || /permissions policy|not allowed in this document/i.test(msg)) {
      return {
        verified: false,
        method: 'WebAuthn',
        reason: 'blocked',
        message: tr('Kufizim sigurie i shfletuesit/iframe për prompt-in OS.', 'Browser/iframe security restriction for OS prompt.'),
      };
    }
    if (name === 'NotAllowedError') {
      return {
        verified: false,
        method: tr('Kyçi i Telefonit', 'Phone Lock'),
        reason: 'cancelled',
        message: tr('Kërkesa e sigurisë u anulua ose skadoi.', 'Security request was cancelled or timed out.'),
      };
    }
    return {
      verified: false,
      method: 'WebAuthn',
      reason: 'unsupported',
      message: msg || tr('Sistemi nuk mundi të hapte prompt-in e sigurisë.', 'System could not open the security prompt.'),
    };
  }
}
