/**
 * Content script. Runs inside the inspected page and extracts publicly-visible
 * signals only. We never touch form values, cookies, or anything behind auth.
 *
 * Communication: responds to { kind: "scan" } messages from the background
 * service worker or popup with a PageScanResult.
 */

import type { ContentRequest, ContentResponse, PageScanResult } from '@/types';

const MAX_TEXT = 50_000;
const MAX_FOOTER_TEXT = 8_000;
const MAX_LINKS = 400;

chrome.runtime.onMessage.addListener((msg: ContentRequest, _sender, sendResponse) => {
  if (msg?.kind !== 'scan') return false;
  try {
    const scan = scanPage();
    const res: ContentResponse = { ok: true, scan };
    sendResponse(res);
  } catch (err) {
    const res: ContentResponse = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    sendResponse(res);
  }
  // Synchronous response — return false.
  return false;
});

function scanPage(): PageScanResult {
  const url = location.href;
  const origin = location.origin;
  const hostname = location.hostname;
  const title = document.title || '';

  const description =
    document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

  const footerEl = pickFooter();
  const footerText = (footerEl?.innerText || '').slice(0, MAX_FOOTER_TEXT);

  // Visible body text — innerText respects CSS visibility better than textContent.
  const text = (document.body?.innerText || '').slice(0, MAX_TEXT);

  const mailtos = collectMailtos();
  const links = collectLinks(footerEl);
  const contactPoints = collectContactPoints();

  return {
    url,
    origin,
    hostname,
    title,
    text,
    footerText,
    mailtos,
    links,
    contactPoints,
    description,
  };
}

function pickFooter(): HTMLElement | null {
  const candidates: HTMLElement[] = [];
  document.querySelectorAll('footer').forEach((el) => {
    if (el instanceof HTMLElement) candidates.push(el);
  });
  document
    .querySelectorAll('[role="contentinfo"], [class*="footer" i], [id*="footer" i]')
    .forEach((el) => {
      if (el instanceof HTMLElement) candidates.push(el);
    });
  // Pick the largest visible footer-ish element.
  let best: HTMLElement | null = null;
  let bestSize = 0;
  for (const el of candidates) {
    const size = (el.innerText || '').length;
    if (size > bestSize) {
      best = el;
      bestSize = size;
    }
  }
  return best;
}

function collectMailtos(): string[] {
  const set = new Set<string>();
  document.querySelectorAll('a[href^="mailto:" i]').forEach((a) => {
    const href = (a as HTMLAnchorElement).href;
    if (href) set.add(href);
  });
  return [...set];
}

function collectLinks(footerEl: HTMLElement | null): PageScanResult['links'] {
  const out: PageScanResult['links'] = [];
  const anchors = document.querySelectorAll('a[href]');
  let count = 0;
  for (const a of Array.from(anchors)) {
    if (count >= MAX_LINKS) break;
    const anchor = a as HTMLAnchorElement;
    const href = anchor.href;
    if (!href) continue;
    const text = (anchor.innerText || anchor.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 200);
    const inFooter = !!footerEl && footerEl.contains(anchor);
    out.push({ href, text, inFooter });
    count++;
  }
  return out;
}

function collectContactPoints(): PageScanResult['contactPoints'] {
  const out: PageScanResult['contactPoints'] = [];
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of Array.from(scripts)) {
    const raw = (script.textContent || '').trim();
    if (!raw) continue;
    try {
      // Some sites embed arrays or multiple objects.
      const parsed = JSON.parse(raw);
      walkForContactPoints(parsed, out);
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return out;
}

function walkForContactPoints(node: unknown, out: PageScanResult['contactPoints']): void {
  if (!node) return;
  if (Array.isArray(node)) {
    for (const item of node) walkForContactPoints(item, out);
    return;
  }
  if (typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const type = String(obj['@type'] || '').toLowerCase();
  if (type === 'contactpoint' || type.includes('contactpoint')) {
    const email = typeof obj.email === 'string' ? obj.email : undefined;
    const url = typeof obj.url === 'string' ? obj.url : undefined;
    const contactType = typeof obj.contactType === 'string' ? obj.contactType : undefined;
    if (email || url) out.push({ email, url, contactType });
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') walkForContactPoints(value, out);
  }
}
