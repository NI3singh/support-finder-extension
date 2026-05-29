/**
 * Discovery engine.
 *
 * Combines:
 *   - Layer 1: signals extracted from the current page (content script result).
 *   - Layer 2: same-domain path probing (HEAD/GET via service worker fetch).
 *   - Layer 3: structured data (schema.org ContactPoint).
 *   - Layer 4: confidence scoring and ranking.
 */

import type { DiscoveryResult, PageScanResult, SupportCandidate } from '@/types';
import { extractEmails } from './email';
import {
  detectUrlPathHint,
  findKeywordInText,
  inferTypeFromUrl,
  sameRegistrableDomain,
  scoreCandidate,
} from './scoring';
import { LIVE_CHAT_SIGNALS, PROBE_PATHS, SUPPORT_KEYWORDS } from './keywords';

const PROBE_TIMEOUT_MS = 2500;
const MAX_PROBES = 6;

export interface BuildResultOptions {
  scan: PageScanResult;
  /** If true, perform same-domain path probes. */
  probe?: boolean;
}

export async function buildDiscoveryResult({
  scan,
  probe = true,
}: BuildResultOptions): Promise<DiscoveryResult> {
  const candidates: SupportCandidate[] = [];
  const seenValues = new Set<string>();

  const add = (c: SupportCandidate) => {
    const key = `${c.type}:${c.value.toLowerCase()}`;
    if (seenValues.has(key)) return;
    seenValues.add(key);
    candidates.push(c);
  };

  // ── Layer 1: page signals ────────────────────────────────────────────────
  collectFromMailtos(scan, add);
  collectFromLinks(scan, add);
  collectFromBodyText(scan, add);

  // ── Layer 3: structured data (run before probes so probes can dedupe) ──
  collectFromStructured(scan, add);

  // Live chat signals (script tags inspected client-side already produce links
  // sometimes; here we just check the visible text for hint-words).
  detectLiveChat(scan, add);

  // ── Layer 2: same-domain path probing ────────────────────────────────────
  if (probe) {
    const existingProbed = new Set(
      candidates.filter((c) => c.type !== 'email').map((c) => normalizeUrl(c.value))
    );
    await probeSameDomain(scan, existingProbed, add);
  }

  // ── Layer 4: rank ────────────────────────────────────────────────────────
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0] ?? null;
  const alternatives = candidates.slice(1, 6);

  return {
    origin: scan.origin,
    hostname: scan.hostname,
    title: scan.title,
    best,
    alternatives,
    scannedAt: Date.now(),
    fromCache: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 1 helpers
// ─────────────────────────────────────────────────────────────────────────────

function collectFromMailtos(scan: PageScanResult, add: (c: SupportCandidate) => void): void {
  for (const raw of scan.mailtos) {
    const cleaned = raw
      .replace(/^mailto:/i, '')
      .split('?')[0]
      ?.trim();
    if (!cleaned) continue;
    for (const email of extractEmails(cleaned)) {
      add(
        scoreCandidate({
          value: email,
          type: 'email',
          label: email,
          source: 'page',
          pageHost: scan.hostname,
          inFooter: scan.footerText.toLowerCase().includes(email),
          sameDomain: true,
        })
      );
    }
  }
}

function collectFromLinks(scan: PageScanResult, add: (c: SupportCandidate) => void): void {
  for (const link of scan.links) {
    const text = (link.text || '').trim();
    const href = link.href;
    if (!href || href.startsWith('javascript:')) continue;

    if (href.toLowerCase().startsWith('mailto:')) continue; // handled above

    const url = safeUrl(href, scan.origin);
    if (!url) continue;
    // Only consider http(s) links.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;

    const keyword = findKeywordInText(text);
    const pathHint = detectUrlPathHint(url.href);

    // Require *some* support signal.
    if (!keyword && pathHint === 0) continue;

    const sameDomain = sameRegistrableDomain(url.hostname, scan.hostname);
    const type = inferTypeFromUrl(url.href);

    add(
      scoreCandidate({
        value: url.href,
        type: type === 'unknown' ? 'support_page' : type,
        label: text || url.href,
        source: 'page',
        inFooter: link.inFooter,
        textKeyword: keyword,
        sameDomain,
        pathHintWeight: pathHint,
      })
    );
  }
}

function collectFromBodyText(scan: PageScanResult, add: (c: SupportCandidate) => void): void {
  const seen = new Set<string>();
  for (const email of extractEmails(scan.text)) {
    if (seen.has(email)) continue;
    seen.add(email);
    add(
      scoreCandidate({
        value: email,
        type: 'email',
        label: email,
        source: 'page',
        pageHost: scan.hostname,
        inFooter: scan.footerText.toLowerCase().includes(email),
        sameDomain: true,
      })
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured data (schema.org ContactPoint)
// ─────────────────────────────────────────────────────────────────────────────

function collectFromStructured(scan: PageScanResult, add: (c: SupportCandidate) => void): void {
  for (const cp of scan.contactPoints) {
    if (cp.email) {
      for (const email of extractEmails(cp.email)) {
        add(
          scoreCandidate({
            value: email,
            type: 'email',
            label: cp.contactType ? `${email} (${cp.contactType})` : email,
            source: 'structured',
            pageHost: scan.hostname,
            fromStructuredData: true,
            sameDomain: true,
          })
        );
      }
    }
    if (cp.url) {
      const url = safeUrl(cp.url, scan.origin);
      if (!url) continue;
      const type = inferTypeFromUrl(url.href);
      add(
        scoreCandidate({
          value: url.href,
          type: type === 'unknown' ? 'support_page' : type,
          label: cp.contactType ?? url.href,
          source: 'structured',
          fromStructuredData: true,
          sameDomain: sameRegistrableDomain(url.hostname, scan.hostname),
          pathHintWeight: detectUrlPathHint(url.href),
        })
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Live chat detection (text-only — script-tag inspection happens in content)
// ─────────────────────────────────────────────────────────────────────────────

function detectLiveChat(scan: PageScanResult, add: (c: SupportCandidate) => void): void {
  const haystack = (scan.text + ' ' + scan.title).toLowerCase();
  if (!/live chat|chat with us|start chat|chat support/.test(haystack)) return;
  // Surface the current page itself as the live-chat entrypoint candidate.
  add(
    scoreCandidate({
      value: scan.url,
      type: 'live_chat',
      label: 'Live chat on this page',
      source: 'page',
      sameDomain: true,
    })
  );
  // If we matched a known vendor script URL elsewhere, we'd already have a link.
  for (const link of scan.links) {
    const lower = (link.href || '').toLowerCase();
    if (LIVE_CHAT_SIGNALS.some((s) => lower.includes(s))) {
      add(
        scoreCandidate({
          value: link.href,
          type: 'live_chat',
          label: link.text || 'Live chat',
          source: 'page',
          sameDomain: false,
        })
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer 2: same-domain probing
// ─────────────────────────────────────────────────────────────────────────────

async function probeSameDomain(
  scan: PageScanResult,
  alreadyProbed: Set<string>,
  add: (c: SupportCandidate) => void
): Promise<void> {
  const tasks: Promise<void>[] = [];
  let count = 0;
  for (const path of PROBE_PATHS) {
    if (count >= MAX_PROBES) break;
    const url = scan.origin + path;
    if (alreadyProbed.has(normalizeUrl(url))) continue;
    count++;
    tasks.push(probeOne(scan, url, add));
  }
  await Promise.all(tasks);
}

async function probeOne(
  scan: PageScanResult,
  url: string,
  add: (c: SupportCandidate) => void
): Promise<void> {
  const result = await fetchWithTimeout(url);
  if (!result.ok) return;

  // Parse a snippet of the page for title + visible support keywords + emails.
  const title = extractTitle(result.body);
  const hasSupportContent = SUPPORT_KEYWORDS.some((kw) => result.body.toLowerCase().includes(kw));

  const type = inferTypeFromUrl(url);
  add(
    scoreCandidate({
      value: result.finalUrl,
      type: type === 'unknown' ? 'support_page' : type,
      label: title || url,
      source: 'probe',
      sameDomain: true,
      pathHintWeight: detectUrlPathHint(url),
      probeOk: true,
      probeHasSupportContent: hasSupportContent,
    })
  );

  // Surface emails discovered on the probed page too.
  for (const email of extractEmails(result.body)) {
    add(
      scoreCandidate({
        value: email,
        type: 'email',
        label: email,
        source: 'probe',
        pageHost: scan.hostname,
        sameDomain: true,
      })
    );
  }
}

interface FetchResult {
  ok: boolean;
  body: string;
  finalUrl: string;
}

async function fetchWithTimeout(url: string): Promise<FetchResult> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { Accept: 'text/html,*/*;q=0.5' },
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, body: '', finalUrl: url };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('text/plain'))
      return { ok: false, body: '', finalUrl: url };
    const body = (await res.text()).slice(0, 200_000);
    return { ok: true, body, finalUrl: res.url || url };
  } catch {
    return { ok: false, body: '', finalUrl: url };
  }
}

function extractTitle(html: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return '';
  return m[1].replace(/\s+/g, ' ').trim().slice(0, 120);
}

// ─────────────────────────────────────────────────────────────────────────────
// utils
// ─────────────────────────────────────────────────────────────────────────────

function safeUrl(href: string, base: string): URL | null {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    return url.href.replace(/\/$/, '').toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}
