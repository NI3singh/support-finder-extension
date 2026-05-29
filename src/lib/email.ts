/**
 * Email extraction and validation. Conservative on purpose:
 * we'd rather miss a low-quality email than fabricate one.
 */

// RFC-5322 simplified. We intentionally require a TLD of 2+ chars.
const EMAIL_RE =
  /(?:^|[\s<>"'(),;:])([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?=$|[\s<>"'(),;:?!.])/g;

// Addresses we never want to surface — they're not real human inboxes.
const BLOCKED_LOCAL_PARTS = new Set([
  'example',
  'test',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'mailer-daemon',
  'postmaster',
  'abuse',
]);

const BLOCKED_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'sentry.io',
  'wixpress.com',
  'wix.com',
]);

const SUPPORT_LOCAL_HINTS = [
  'support',
  'help',
  'contact',
  'hello',
  'info',
  'service',
  'customer',
  'care',
  'feedback',
  'complaints',
];

export interface ExtractedEmail {
  email: string;
  /** Heuristic score 0..1 of how "support-y" this email looks. */
  hint: number;
}

export function extractEmails(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  EMAIL_RE.lastIndex = 0;
  while ((match = EMAIL_RE.exec(text)) !== null) {
    const raw = match[1];
    if (!raw) continue;
    const email = raw.toLowerCase();
    if (isAcceptableEmail(email)) found.add(email);
  }
  return [...found];
}

export function isAcceptableEmail(email: string): boolean {
  const [local, domain] = email.split('@');
  if (!local || !domain) return false;
  if (BLOCKED_LOCAL_PARTS.has(local)) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  // Reject obviously-broken or asset-looking strings.
  if (/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i.test(email)) return false;
  if (email.length > 254) return false;
  return true;
}

export function scoreEmail(email: string, pageHost: string): ExtractedEmail {
  const [local, domain] = email.split('@');
  let hint = 0.3; // baseline: a real-looking email is mildly useful
  if (SUPPORT_LOCAL_HINTS.includes(local)) hint += 0.4;
  if (sameRegistrableDomain(domain, pageHost)) hint += 0.25;
  if (/support|help|care|service/.test(local)) hint += 0.1;
  return { email, hint: Math.min(hint, 1) };
}

/**
 * Best-effort same-domain check. We don't ship a public-suffix list in the
 * extension to keep it lightweight, so we compare the last two labels.
 */
export function sameRegistrableDomain(a: string, b: string): boolean {
  if (!a || !b) return false;
  const aa = a.toLowerCase().split('.').slice(-2).join('.');
  const bb = b.toLowerCase().split('.').slice(-2).join('.');
  return aa === bb;
}
