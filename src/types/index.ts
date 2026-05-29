/**
 * Shared types across content script, background, and popup.
 */

export type SupportType =
  | 'email'
  | 'contact_form'
  | 'help_center'
  | 'live_chat'
  | 'support_page'
  | 'unknown';

export interface SupportCandidate {
  /** The actionable value: email address, URL, etc. */
  value: string;
  /** What kind of support route this is. */
  type: SupportType;
  /** Human-readable label, e.g. "Contact Us" or page <title>. */
  label: string;
  /** 0..1 confidence score. */
  score: number;
  /** Short human explanation of why this was ranked. */
  reason: string;
  /** Where the candidate was found: 'page' (current tab) or 'probe' (same-domain). */
  source: 'page' | 'probe' | 'structured';
}

export interface PageScanResult {
  url: string;
  origin: string;
  hostname: string;
  title: string;
  /** Visible page text, truncated. */
  text: string;
  /**
   * Full DOM text content (excluding script/style), truncated. Catches emails
   * that exist in the DOM but aren't in the rendered `text` — e.g. sections that
   * are visually hidden, animated-in, or split across inline elements.
   */
  deepText?: string;
  /** Footer text only, truncated. */
  footerText: string;
  /** All mailto: addresses found on the page. */
  mailtos: string[];
  /** All anchor links with their text + href. */
  links: Array<{ href: string; text: string; inFooter: boolean }>;
  /** schema.org ContactPoint entries discovered in JSON-LD. */
  contactPoints: Array<{ email?: string; url?: string; contactType?: string }>;
  /** Meta description. */
  description: string;
}

export interface DiscoveryResult {
  origin: string;
  hostname: string;
  title: string;
  best: SupportCandidate | null;
  alternatives: SupportCandidate[];
  scannedAt: number;
  fromCache: boolean;
}

export type PopupRequest =
  | { kind: 'discover'; tabId: number; url: string }
  | { kind: 'clear-cache'; origin: string };

export type PopupResponse = { ok: true; result: DiscoveryResult } | { ok: false; error: string };

export type ContentRequest = { kind: 'scan' };
export type ContentResponse = { ok: true; scan: PageScanResult } | { ok: false; error: string };
