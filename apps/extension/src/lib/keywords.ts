/**
 * Keyword dictionaries used by the discovery engine.
 * Kept deliberately small and conservative — English-first with a few common
 * non-English equivalents.
 */

export const SUPPORT_KEYWORDS = [
  'support',
  'help',
  'contact',
  'contact us',
  'customer service',
  'customer care',
  'customer support',
  'help center',
  'help centre',
  'helpdesk',
  'help desk',
  'report',
  'complaint',
  'complaints',
  'faq',
  'ticket',
  'submit a ticket',
  'billing',
  'refund',
  'returns',
  'feedback',
  // common non-English equivalents
  'kontakt',
  'soporte',
  'ayuda',
  'contacto',
  'atendimento',
  'assistenza',
  'サポート',
  'お問い合わせ',
];

export const STRONG_KEYWORDS = new Set([
  'support',
  'contact',
  'contact us',
  'customer service',
  'customer support',
  'help center',
  'help centre',
  'helpdesk',
  'submit a ticket',
]);

/**
 * Common URL path segments worth probing on the same domain.
 * Order matters: most likely first.
 */
export const PROBE_PATHS = [
  '/support',
  '/contact',
  '/contact-us',
  '/contactus',
  '/help',
  '/help-center',
  '/helpcenter',
  '/customer-service',
  '/customer-support',
  '/customerservice',
  '/get-help',
  '/get-in-touch',
  '/faq',
  '/about/contact',
  '/about-us/contact',
  '/report',
  '/feedback',
  '/billing',
  '/refund',
  '/returns',
];

/** URL substrings that strongly indicate a support page. */
export const URL_PATH_HINTS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\/support(\/|$|\?)/i, weight: 0.35 },
  { pattern: /\/contact(-us)?(\/|$|\?)/i, weight: 0.35 },
  { pattern: /\/help(-center|centre)?(\/|$|\?)/i, weight: 0.3 },
  { pattern: /\/customer[-_ ]?(service|support|care)/i, weight: 0.3 },
  { pattern: /\/helpdesk/i, weight: 0.3 },
  { pattern: /\/ticket/i, weight: 0.2 },
  { pattern: /\/faq/i, weight: 0.15 },
  { pattern: /\/feedback/i, weight: 0.15 },
  { pattern: /\/report/i, weight: 0.1 },
];

/** Live chat detection — domains/scripts that strongly suggest chat widgets. */
export const LIVE_CHAT_SIGNALS = [
  'intercom',
  'zendesk',
  'drift.com',
  'tawk.to',
  'livechatinc',
  'crisp.chat',
  'hubspot',
  'freshchat',
  'olark',
];

/** Domains that commonly host marketing/sales contact forms (lower priority). */
export const GENERIC_FORM_HINTS = ['sales', 'demo', 'press', 'media', 'career'];
