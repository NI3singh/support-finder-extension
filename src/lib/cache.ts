/**
 * Per-domain result cache backed by chrome.storage.local.
 * TTL of 24h by default. Falls back to in-memory map outside extension context
 * (useful for tests).
 */

import type { DiscoveryResult } from '@/types';

const CACHE_PREFIX = 'sf:cache:';
const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

interface CacheEntry {
  result: DiscoveryResult;
  expiresAt: number;
}

const memoryFallback = new Map<string, CacheEntry>();

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;
}

function keyFor(origin: string): string {
  return `${CACHE_PREFIX}${origin}`;
}

export async function getCached(origin: string): Promise<DiscoveryResult | null> {
  const key = keyFor(origin);
  const now = Date.now();

  if (hasChromeStorage()) {
    const out = await chrome.storage.local.get(key);
    const entry = out[key] as CacheEntry | undefined;
    if (!entry) return null;
    if (entry.expiresAt < now) {
      await chrome.storage.local.remove(key);
      return null;
    }
    return { ...entry.result, fromCache: true };
  }

  const entry = memoryFallback.get(key);
  if (!entry) return null;
  if (entry.expiresAt < now) {
    memoryFallback.delete(key);
    return null;
  }
  return { ...entry.result, fromCache: true };
}

export async function setCached(
  origin: string,
  result: DiscoveryResult,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const entry: CacheEntry = {
    result: { ...result, fromCache: false },
    expiresAt: Date.now() + ttlMs,
  };
  const key = keyFor(origin);
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: entry });
  } else {
    memoryFallback.set(key, entry);
  }
}

export async function clearCached(origin: string): Promise<void> {
  const key = keyFor(origin);
  if (hasChromeStorage()) {
    await chrome.storage.local.remove(key);
  } else {
    memoryFallback.delete(key);
  }
}
