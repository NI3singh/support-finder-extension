/**
 * Generate a short, neutral message draft the user can copy/paste.
 * Deliberately generic — no AI, no fabrication.
 */

import type { DiscoveryResult } from '@/types';

export function buildDraft(result: DiscoveryResult, pageUrl: string): string {
  const site = result.hostname || result.title || 'your service';
  const lines = [
    `Hi ${site} support team,`,
    '',
    `I'm reaching out about an issue I'm experiencing on your site.`,
    `Page: ${pageUrl}`,
    '',
    `Issue: [describe your issue here]`,
    '',
    `Could you please help me resolve this? Thanks in advance.`,
  ];
  return lines.join('\n');
}
