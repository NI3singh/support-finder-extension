import { describe, expect, it } from 'vitest';
import { detectUrlPathHint, findKeywordInText, inferTypeFromUrl, scoreCandidate } from '../scoring';

describe('inferTypeFromUrl', () => {
  it('identifies help centers', () => {
    expect(inferTypeFromUrl('https://acme.com/help-center')).toBe('help_center');
    expect(inferTypeFromUrl('https://acme.com/help')).toBe('help_center');
  });
  it('identifies contact forms', () => {
    expect(inferTypeFromUrl('https://acme.com/contact-us')).toBe('contact_form');
  });
  it('identifies support pages', () => {
    expect(inferTypeFromUrl('https://acme.com/customer-service')).toBe('support_page');
  });
  it('identifies emails', () => {
    expect(inferTypeFromUrl('mailto:support@acme.com')).toBe('email');
  });
});

describe('detectUrlPathHint', () => {
  it('returns positive hints for support paths', () => {
    expect(detectUrlPathHint('https://acme.com/support')).toBeGreaterThan(0);
    expect(detectUrlPathHint('https://acme.com/contact-us')).toBeGreaterThan(0);
  });
  it('returns 0 for unrelated paths', () => {
    expect(detectUrlPathHint('https://acme.com/products/widget')).toBe(0);
  });
});

describe('findKeywordInText', () => {
  it('prefers longest match', () => {
    expect(findKeywordInText('Help Center')).toBe('help center');
    expect(findKeywordInText('Customer Service')).toBe('customer service');
  });
  it('returns null when no keyword present', () => {
    expect(findKeywordInText('About the team')).toBeNull();
  });
});

describe('scoreCandidate', () => {
  it('ranks footer support links higher than generic ones', () => {
    const strong = scoreCandidate({
      value: 'https://acme.com/support',
      type: 'support_page',
      label: 'Support',
      source: 'page',
      inFooter: true,
      textKeyword: 'support',
      sameDomain: true,
      pathHintWeight: 0.35,
    });
    const weak = scoreCandidate({
      value: 'https://acme.com/faq',
      type: 'support_page',
      label: 'FAQ',
      source: 'page',
      sameDomain: true,
      pathHintWeight: 0.15,
    });
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('clamps scores to [0, 1]', () => {
    const c = scoreCandidate({
      value: 'support@acme.com',
      type: 'email',
      label: 'support@acme.com',
      source: 'structured',
      inFooter: true,
      sameDomain: true,
      pathHintWeight: 0.35,
      fromStructuredData: true,
      pageHost: 'acme.com',
      probeOk: true,
      probeHasSupportContent: true,
    });
    expect(c.score).toBeLessThanOrEqual(1);
    expect(c.score).toBeGreaterThan(0.8);
  });
});
