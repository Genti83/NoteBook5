export interface CalcResult {
  ok: boolean;
  value?: string;
  error?: string;
  normalizedExpr?: string;
}

interface BigDec {
  coeff: bigint;
  scale: number;
}

type Token =
  | { type: 'num'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'pct' }
  | { type: 'lparen' }
  | { type: 'rparen' };

const MAX_DIV_SCALE = 18;
const DISPLAY_SCALE = 12;

function pow10(n: number): bigint {
  if (n <= 0) return 1n;
  return 10n ** BigInt(n);
}

function normalizeDec(d: BigDec): BigDec {
  let { coeff, scale } = d;
  if (coeff === 0n) return { coeff: 0n, scale: 0 };
  while (scale > 0 && coeff % 10n === 0n) {
    coeff /= 10n;
    scale -= 1;
  }
  return { coeff, scale };
}

function parseDec(str: string): BigDec {
  const cleaned = str.trim();
  const dotIdx = cleaned.indexOf('.');
  if (dotIdx === -1) {
    return normalizeDec({ coeff: BigInt(cleaned || '0'), scale: 0 });
  }
  const intPart = cleaned.slice(0, dotIdx) || '0';
  const fracPart = cleaned.slice(dotIdx + 1);
  const scale = fracPart.length;
  const coeff = BigInt(intPart + fracPart);
  return normalizeDec({ coeff, scale });
}

function addDec(a: BigDec, b: BigDec): BigDec {
  const maxScale = Math.max(a.scale, b.scale);
  const ac = a.coeff * pow10(maxScale - a.scale);
  const bc = b.coeff * pow10(maxScale - b.scale);
  return normalizeDec({ coeff: ac + bc, scale: maxScale });
}

function subDec(a: BigDec, b: BigDec): BigDec {
  const maxScale = Math.max(a.scale, b.scale);
  const ac = a.coeff * pow10(maxScale - a.scale);
  const bc = b.coeff * pow10(maxScale - b.scale);
  return normalizeDec({ coeff: ac - bc, scale: maxScale });
}

function mulDec(a: BigDec, b: BigDec): BigDec {
  return normalizeDec({
    coeff: a.coeff * b.coeff,
    scale: a.scale + b.scale,
  });
}

function divDec(a: BigDec, b: BigDec): BigDec {
  if (b.coeff === 0n) {
    throw new Error('DIV_ZERO');
  }
  const targetScale = MAX_DIV_SCALE;
  const shift = targetScale + b.scale - a.scale;
  let num = a.coeff;
  let den = b.coeff;
  if (shift >= 0) {
    num = num * pow10(shift);
  } else {
    den = den * pow10(-shift);
  }
  // Round half-up at the last digit
  const neg = (num < 0n) !== (den < 0n);
  const absNum = num < 0n ? -num : num;
  const absDen = den < 0n ? -den : den;
  let q = absNum / absDen;
  const rem = absNum % absDen;
  if (rem * 2n >= absDen) {
    q += 1n;
  }
  return normalizeDec({
    coeff: neg ? -q : q,
    scale: targetScale,
  });
}

function roundToScale(d: BigDec, maxScale: number): BigDec {
  if (d.scale <= maxScale) return normalizeDec(d);
  const drop = d.scale - maxScale;
  const factor = pow10(drop);
  const neg = d.coeff < 0n;
  const absC = neg ? -d.coeff : d.coeff;
  let q = absC / factor;
  const rem = absC % factor;
  if (rem * 2n >= factor) {
    q += 1n;
  }
  return normalizeDec({
    coeff: neg ? -q : q,
    scale: maxScale,
  });
}

function formatDec(d: BigDec): string {
  const rounded = roundToScale(d, DISPLAY_SCALE);
  if (rounded.coeff === 0n) return '0';
  const neg = rounded.coeff < 0n;
  const digits = (neg ? -rounded.coeff : rounded.coeff).toString();
  if (rounded.scale === 0) {
    return (neg ? '-' : '') + digits;
  }
  let out: string;
  if (digits.length <= rounded.scale) {
    out = '0.' + '0'.repeat(rounded.scale - digits.length) + digits;
  } else {
    const split = digits.length - rounded.scale;
    out = digits.slice(0, split) + '.' + digits.slice(split);
  }
  return (neg ? '-' : '') + out;
}

function tokenize(raw: string): Token[] {
  const expr = raw
    .replace(/×/g, '*')
    .replace(/x/gi, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');

  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let start = i;
      let dotCount = 0;
      while (i < expr.length && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) {
        if (expr[i] === '.') dotCount++;
        if (dotCount > 1) throw new Error('SYNTAX');
        i++;
      }
      let numStr = expr.slice(start, i);
      if (numStr === '.') throw new Error('SYNTAX');
      if (numStr.startsWith('.')) numStr = '0' + numStr;
      if (numStr.endsWith('.')) numStr = numStr.slice(0, -1);
      tokens.push({ type: 'num', value: numStr });
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }
    if (ch === '%') {
      tokens.push({ type: 'pct' });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    throw new Error('SYNTAX');
  }
  return tokens;
}

const HUNDRED: BigDec = { coeff: 100n, scale: 0 };

export function evaluateCalcExpression(
  rawInput: string,
  options?: { trimTrailingOperator?: boolean }
): CalcResult {
  let expr = (rawInput || '').trim();
  if (!expr) return { ok: false, error: 'Gabim' };

  if (options?.trimTrailingOperator) {
    expr = expr.replace(/[+\-*/×x÷.]+$/, '');
    if (!expr) return { ok: false, error: 'Gabim' };
  }

  let tokens: Token[];
  try {
    tokens = tokenize(expr);
  } catch {
    return { ok: false, error: 'Gabim' };
  }
  if (tokens.length === 0) return { ok: false, error: 'Gabim' };

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseFactor(): { value: BigDec; isDirectPct: boolean } {
    const tok = peek();
    if (!tok) throw new Error('SYNTAX');

    if (tok.type === 'op' && (tok.value === '-' || tok.value === '+')) {
      consume();
      const inner = parseFactor();
      const val =
        tok.value === '-'
          ? { coeff: -inner.value.coeff, scale: inner.value.scale }
          : inner.value;
      return { value: val, isDirectPct: inner.isDirectPct };
    }

    if (tok.type === 'lparen') {
      consume();
      const val = parseExpr();
      const close = peek();
      if (!close || close.type !== 'rparen') throw new Error('SYNTAX');
      consume();
      if (peek()?.type === 'pct') {
        consume();
        return { value: divDec(val, HUNDRED), isDirectPct: true };
      }
      return { value: val, isDirectPct: false };
    }

    if (tok.type === 'num') {
      consume();
      const val = parseDec(tok.value);
      if (peek()?.type === 'pct') {
        consume();
        return { value: divDec(val, HUNDRED), isDirectPct: true };
      }
      return { value: val, isDirectPct: false };
    }

    throw new Error('SYNTAX');
  }

  function parseTerm(): { value: BigDec; isDirectPct: boolean } {
    let first = parseFactor();
    let acc = first.value;
    let isBarePct = first.isDirectPct;

    while (peek()?.type === 'op' && (peek() as any).value in { '*': 1, '/': 1 }) {
      isBarePct = false;
      const op = (consume() as { type: 'op'; value: '*' | '/' }).value;
      const right = parseFactor();
      if (op === '*') {
        acc = mulDec(acc, right.value);
      } else {
        acc = divDec(acc, right.value);
      }
    }

    return { value: acc, isDirectPct: isBarePct };
  }

  function parseExpr(): BigDec {
    const first = parseTerm();
    let acc = first.value;

    while (peek()?.type === 'op' && ((peek() as any).value === '+' || (peek() as any).value === '-')) {
      const op = (consume() as { type: 'op'; value: '+' | '-' }).value;
      const right = parseTerm();
      // Calculator accounting rule: A + B% = A + (A * B/100), A - B% = A - (A * B/100)
      const delta = right.isDirectPct ? mulDec(acc, right.value) : right.value;
      acc = op === '+' ? addDec(acc, delta) : subDec(acc, delta);
    }

    return acc;
  }

  try {
    const result = parseExpr();
    if (pos !== tokens.length) {
      return { ok: false, error: 'Gabim' };
    }
    return {
      ok: true,
      value: formatDec(result),
      normalizedExpr: expr,
    };
  } catch (err: any) {
    if (err?.message === 'DIV_ZERO') {
      return { ok: false, error: 'Ndalohet ÷ 0' };
    }
    return { ok: false, error: 'Gabim' };
  }
}

export function hasCalcOperation(expr: string): boolean {
  const s = (expr || '').trim();
  if (!s) return false;
  // Ignore a single leading negative sign (e.g. -500)
  const body = s.startsWith('-') ? s.slice(1) : s;
  return /[+\-×x*÷/%]/.test(body);
}

/**
 * Extracts a standalone numeric amount from a notebook cell (e.g. "1500", "1,250.50",
 * "45.5 kg", "€ 120", "-300 Lek"). Safely ignores dates like "12/05/2026" or "12.05.2026"
 * and multi-number sentences.
 */
export function extractNumericFromCell(raw: string): string | null {
  const s = (raw || '').trim();
  if (!s) return null;
  // Reject obvious date/time patterns (dd/mm/yyyy, dd.mm.yyyy, yyyy-mm-dd, hh:mm)
  if (/^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/.test(s) || /^\d{1,2}:\d{2}/.test(s)) return null;
  // Strip common surrounding currency/unit tokens only if a single clear number remains
  const stripped = s
    .replace(/^(lek[eë]?|all|eur|usd|chf|gbp|€|\$|£)\s*/i, '')
    .replace(/\s*(lek[eë]?|all|eur|usd|chf|gbp|kg|gr|g|mg|l|ml|m|cm|mm|km|cop[eë]?|pcs|x|€|\$|£)\.?$/i, '')
    .trim();
  if (!stripped) return null;
  // Handle grouped thousands like 1,250.50 or 1.250,50 or plain 1250.50 / 1250,50
  let normalized = stripped.replace(/\s+/g, '');
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/,/g, '');
  } else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = normalized.replace(',', '.');
  }
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return normalized;
}

export function sumColumnNumericCells(values: string[]): { count: number; total: string; hasEuro: boolean } | null {
  let acc: BigDec = { coeff: 0n, scale: 0 };
  let count = 0;
  let hasEuro = false;
  for (const val of values) {
    const numStr = extractNumericFromCell(val);
    if (!numStr) continue;
    if (/€|\beur\b/i.test(val || '')) hasEuro = true;
    try {
      acc = addDec(acc, parseDec(numStr));
      count++;
    } catch {
      // Ignore malformed large numbers
    }
  }
  if (count === 0) return null;
  return { count, total: formatDec(acc), hasEuro };
}
