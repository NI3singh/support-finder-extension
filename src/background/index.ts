/**
 * Background service worker. Coordinates work between popup and content script,
 * runs the discovery engine (which performs same-domain probing), and manages
 * the per-domain cache.
 */

import { buildDiscoveryResult } from '@/lib/discovery';
import { clearCached, getCached, setCached } from '@/lib/cache';
import type {
  ContentRequest,
  ContentResponse,
  DiscoveryResult,
  PopupRequest,
  PopupResponse,
} from '@/types';

chrome.runtime.onMessage.addListener((msg: PopupRequest, _sender, sendResponse) => {
  handleMessage(msg)
    .then((response) => sendResponse(response))
    .catch((err) => {
      const response: PopupResponse = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      sendResponse(response);
    });
  // Indicates we'll respond asynchronously.
  return true;
});

async function handleMessage(msg: PopupRequest): Promise<PopupResponse> {
  if (msg?.kind === 'discover') {
    return discover(msg.tabId, msg.url);
  }
  if (msg?.kind === 'clear-cache') {
    await clearCached(msg.origin);
    // Return a minimal "cleared" result so the popup can re-fetch.
    const empty: DiscoveryResult = {
      origin: msg.origin,
      hostname: new URL(msg.origin).hostname,
      title: '',
      best: null,
      alternatives: [],
      scannedAt: Date.now(),
      fromCache: false,
    };
    return { ok: true, result: empty };
  }
  return { ok: false, error: 'Unknown request' };
}

async function discover(tabId: number, pageUrl: string): Promise<PopupResponse> {
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return { ok: false, error: 'Invalid page URL' };
  }

  // Try cache first.
  const cached = await getCached(origin);
  if (cached) return { ok: true, result: cached };

  // Ask the content script to scan the page.
  const scanRes = await requestScan(tabId);
  if (!scanRes.ok) return { ok: false, error: scanRes.error };

  // Run discovery (with same-domain probing).
  const result = await buildDiscoveryResult({ scan: scanRes.scan, probe: true });

  await setCached(origin, result);
  return { ok: true, result };
}

function requestScan(tabId: number): Promise<ContentResponse> {
  const req: ContentRequest = { kind: 'scan' };
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, req, (response: ContentResponse) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: chrome.runtime.lastError.message || 'Content script unavailable on this page.',
          });
          return;
        }
        resolve(response);
      });
    } catch (err) {
      resolve({
        ok: false,
        error: err instanceof Error ? err.message : 'Scan failed',
      });
    }
  });
}
