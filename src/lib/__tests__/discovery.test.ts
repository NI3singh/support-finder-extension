import { describe, expect, it } from 'vitest';
import { buildDiscoveryResult } from '../discovery';
import type { PageScanResult } from '@/types';

function mockScan(partial: Partial<PageScanResult>): PageScanResult {
  return {
    url: 'https://acme.com/',
    origin: 'https://acme.com',
    hostname: 'acme.com',
    title: 'Acme',
    text: '',
    footerText: '',
    mailtos: [],
    links: [],
    contactPoints: [],
    description: '',
    ...partial,
  };
}

describe('buildDiscoveryResult', () => {
  it('surfaces a mailto as the best result when present', async () => {
    const result = await buildDiscoveryResult({
      scan: mockScan({
        mailtos: ['mailto:support@acme.com'],
        text: 'Questions? support@acme.com',
        footerText: 'Contact: support@acme.com',
      }),
      probe: false,
    });
    expect(result.best).not.toBeNull();
    expect(result.best?.type).toBe('email');
    expect(result.best?.value).toBe('support@acme.com');
  });

  it('returns null best when nothing is found', async () => {
    const result = await buildDiscoveryResult({
      scan: mockScan({}),
      probe: false,
    });
    expect(result.best).toBeNull();
    expect(result.alternatives).toHaveLength(0);
  });

  it('picks a support_page link over an unrelated link', async () => {
    const result = await buildDiscoveryResult({
      scan: mockScan({
        links: [
          { href: 'https://acme.com/blog', text: 'Blog', inFooter: false },
          {
            href: 'https://acme.com/support',
            text: 'Support',
            inFooter: true,
          },
        ],
      }),
      probe: false,
    });
    expect(result.best?.value).toBe('https://acme.com/support');
  });

  it('respects schema.org ContactPoint emails', async () => {
    const result = await buildDiscoveryResult({
      scan: mockScan({
        contactPoints: [
          {
            email: 'help@acme.com',
            contactType: 'customer support',
          },
        ],
      }),
      probe: false,
    });
    expect(result.best?.type).toBe('email');
    expect(result.best?.value).toBe('help@acme.com');
  });

  it('extracts an email from deepText and ranks it above a same-page #anchor', async () => {
    const result = await buildDiscoveryResult({
      scan: mockScan({
        url: 'https://portfolio.example/',
        origin: 'https://portfolio.example',
        hostname: 'portfolio.example',
        text: 'Home About Projects', // contact section not in rendered innerText
        deepText: 'Get in touch: nitin@gmail.com',
        links: [{ href: 'https://portfolio.example/#contact', text: 'Contact', inFooter: false }],
      }),
      probe: false,
    });
    expect(result.best?.type).toBe('email');
    expect(result.best?.value).toBe('nitin@gmail.com');
    // The #contact anchor is still surfaced, just ranked lower.
    const anchor = result.alternatives.find((c) => c.value.includes('#contact'));
    expect(anchor).toBeDefined();
  });

  it('deduplicates the same email from multiple sources', async () => {
    const result = await buildDiscoveryResult({
      scan: mockScan({
        mailtos: ['mailto:support@acme.com'],
        text: 'Email us at support@acme.com',
        contactPoints: [{ email: 'support@acme.com' }],
      }),
      probe: false,
    });
    const emails = [result.best, ...result.alternatives].filter((c) => c?.type === 'email');
    expect(emails).toHaveLength(1);
  });
});
