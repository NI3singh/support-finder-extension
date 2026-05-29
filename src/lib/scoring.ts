/**
 * Confidence scoring for support candidates.
 *
 * Scores are bounded to [0, 1]. The scoring is intentionally simple and
 * deterministic: each signal adds a small weight, and the final score is
 * clamped. This makes the ranking explainable and easy to debug.
 */

import type { SupportCandidate, SupportType } from '@/types';
import { STRONG_KEYWORDS, SUPPORT_KEYWORDS, URL_PATH_HINTS } from './keywords';
import { sameRegistrableDomain, scoreEmail } from './email';

interface ScoreInputs {
  value: string;
  type: SupportType;
  label: string;
  /** Where the candidate came from. */
  source: SupportCandidate['source'];
  /** Whether the candidate was found in the page footer. */
  inFooter?: boolean;
  /** Whether the link text contained a strong support keyword. */
  textKeyword?: string | null;
  /** Whether candidate is on the same registrable domain as the page. */
  sameDomain?: boolean;
  /** Whether the URL/path itself matched a support pattern. */
  pathHintWeight?: number;
  /** Page hostname for email scoring. */
  pageHost?: string;
  /** Whether this came from schema.org ContactPoint. */
  fromStructuredData?: boolean;
  /** Whether the page at the URL probed successfully (HTTP 200). */
  probeOk?: boolean;
  /** Whether the probed page contains support keywords in title/body. */
  probeHasSupportContent?: boolean;
  /** Whether this is a same-page "#section" anchor (scroll-only, not a route). */
  samePageAnchor?: boolean;
}

const TYPE_BASE: Record<SupportType, number> = {
  email: 0.35,
  contact_form: 0.3,
  help_center: 0.3,
  live_chat: 0.3,
  support_page: 0.25,
  unknown: 0.1,
};

export function scoreCandidate(input: ScoreInputs): SupportCandidate {
  const reasons: string[] = [];
  let score = TYPE_BASE[input.type];
  reasons.push(`base ${input.type}`);

  if (input.fromStructuredData) {
    score += 0.25;
    reasons.push('schema.org');
  }
  if (input.source === 'page') {
    score += 0.1;
    reasons.push('on current page');
  }
  if (input.inFooter) {
    score += 0.1;
    reasons.push('footer');
  }
  if (input.sameDomain) {
    score += 0.1;
    reasons.push('same domain');
  }
  if (input.pathHintWeight) {
    score += input.pathHintWeight;
    reasons.push('URL hint');
  }
  if (input.textKeyword) {
    score += STRONG_KEYWORDS.has(input.textKeyword) ? 0.15 : 0.07;
    reasons.push(`text "${input.textKeyword}"`);
  }
  if (input.probeOk) {
    score += 0.05;
    reasons.push('reachable');
  }
  if (input.probeHasSupportContent) {
    score += 0.1;
    reasons.push('support content');
  }

  // A scroll-only same-page anchor is a weak fallback, not a real destination.
  if (input.samePageAnchor) {
    score -= 0.2;
    reasons.push('same-page section');
  }

  // Email-specific boost based on local-part heuristics.
  if (input.type === 'email' && input.pageHost) {
    const { hint } = scoreEmail(input.value, input.pageHost);
    score += hint * 0.3;
    if (hint > 0.6) reasons.push('support-style address');
  }

  return {
    value: input.value,
    type: input.type,
    label: input.label,
    score: Math.max(0, Math.min(1, Number(score.toFixed(3)))),
    reason: reasons.join(', '),
    source: input.source,
  };
}

export function detectUrlPathHint(url: string): number {
  let maxHint = 0;
  for (const { pattern, weight } of URL_PATH_HINTS) {
    if (pattern.test(url) && weight > maxHint) maxHint = weight;
  }
  return maxHint;
}

export function inferTypeFromUrl(url: string): SupportType {
  const u = url.toLowerCase();
  if (u.startsWith('mailto:')) return 'email';
  if (/help[-_]?(center|centre)|\/help(\/|$)/i.test(u)) return 'help_center';
  if (/contact(-us)?|\/get-in-touch/i.test(u)) return 'contact_form';
  if (/support|customer[-_ ]?(service|support|care)|helpdesk|ticket/i.test(u))
    return 'support_page';
  if (/chat/i.test(u)) return 'live_chat';
  return 'unknown';
}

export function findKeywordInText(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  // Prefer the longest matching keyword to avoid "help" matching inside "help center".
  let best: string | null = null;
  for (const kw of SUPPORT_KEYWORDS) {
    if (lower.includes(kw)) {
      if (!best || kw.length > best.length) best = kw;
    }
  }
  return best;
}

export { sameRegistrableDomain };
