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

async function requestScan(tabId: number): Promise<ContentResponse> {
  const first = await sendScan(tabId);
  if (first.ok) return first;

  // A connection error means the content script isn't running in this tab —
  // typically because the tab was already open before the extension was
  // installed or reloaded. Inject it on demand and retry once. Genuine scan
  // failures (the content script replied with an error) are returned as-is.
  if (!isConnectionError(first.error)) return first;

  const injected = await injectContentScript(tabId);
  if (!injected.ok) return { ok: false, error: injected.error };

  return sendScan(tabId);
}

function sendScan(tabId: number): Promise<ContentResponse> {
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

async function injectContentScript(
  tabId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
  if (files.length === 0) {
    return { ok: false, error: 'No content script registered to inject.' };
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Couldn't access this page (${err.message}).`
          : "Couldn't access this page.",
    };
  }
}

function isConnectionError(error?: string): boolean {
  if (!error) return false;
  return /receiving end does not exist|could not establish connection|message channel closed/i.test(
    error,
  );
}
