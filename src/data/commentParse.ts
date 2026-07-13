import type { Ecotype } from '../types';

export interface ParsedComment {
  ecotype: Ecotype | null;
  pods: string[];
  individuals: string[];
}

const EMPTY: ParsedComment = { ecotype: null, pods: [], individuals: [] };

// "T46Bs" (trailing plural s), "T137A2" — normalize plural away, keep subgroup.
const T_NUMBER = /\bT\d{2,3}[A-Z]{0,2}\d?\b/g;
// "J pod", "K-pod", "J and K pods"
const RESIDENT_POD = /\b([JKL])\s?-?\s?pods?\b/gi;
// Individual residents like "J59", "L87"
const RESIDENT_ID = /\b([JKL])(\d{1,3})\b/g;
// Humpback/gray catalog IDs: "BCX2077", "BCY0324", "CRC-56"
const CATALOG_ID = /\b(BC[XYZ]\s?\d{3,4}|CRC-?\s?\d{1,4})\b/gi;

const BIGGS_HINT = /\bbigg'?s\b|\btransient/i;
const SRKW_HINT = /\bsrkw\b|southern\s+resident/i;

/**
 * Best-effort extraction of ecotype / pods / individual IDs from the
 * free-text `data_source_comments`. ~40% of comments are empty; everything
 * downstream must degrade gracefully to species-only.
 */
export function parseComment(comment: string | null | undefined): ParsedComment {
  if (typeof comment !== 'string' || comment.trim() === '') return { ...EMPTY };
  // Strip leading source tags like "[Orca Network] " so they can't confuse
  // the matchers (they never contain pod info).
  const text = comment.replace(/^\s*(\[[^\]]*\]\s*)+/, '');

  const pods = new Set<string>();
  const individuals = new Set<string>();

  for (const m of text.matchAll(T_NUMBER)) {
    // "T46Bs" is the T46B matriline pluralized — drop a trailing lone "s"
    // only when it isn't part of the match (regex already excludes it).
    pods.add(m[0].toUpperCase());
  }
  // The T-regex can't see "T46Bs" plural because \b stops before 's'; retry
  // with an explicit plural form and normalize.
  for (const m of text.matchAll(/\bT\d{2,3}[A-Z]{0,2}\d?s\b/g)) {
    pods.add(m[0].slice(0, -1).toUpperCase());
  }

  for (const m of text.matchAll(RESIDENT_POD)) {
    pods.add(m[1].toUpperCase());
  }
  for (const m of text.matchAll(RESIDENT_ID)) {
    individuals.add(`${m[1].toUpperCase()}${m[2]}`);
  }
  for (const m of text.matchAll(CATALOG_ID)) {
    individuals.add(m[0].replace(/[\s-]/g, '').toUpperCase());
  }

  let ecotype: Ecotype | null = null;
  if (BIGGS_HINT.test(text)) ecotype = 'biggs';
  else if (SRKW_HINT.test(text)) ecotype = 'srkw';
  else if ([...pods].some((p) => p.startsWith('T'))) ecotype = 'biggs';
  else if ([...pods].some((p) => /^[JKL]$/.test(p))) ecotype = 'srkw';
  else if ([...individuals].some((i) => /^[JKL]\d/.test(i))) ecotype = 'srkw';

  return { ecotype, pods: [...pods].sort(), individuals: [...individuals].sort() };
}
