import { describe, expect, it } from 'vitest';
import { extractEmails, isAcceptableEmail, sameRegistrableDomain, scoreEmail } from '../email';

describe('extractEmails', () => {
  it('finds plain emails in text', () => {
    const emails = extractEmails('Reach us at support@acme.com or hello@acme.com.');
    expect(emails).toEqual(expect.arrayContaining(['support@acme.com', 'hello@acme.com']));
  });

  it('ignores obviously-fake emails', () => {
    expect(extractEmails('noreply@acme.com')).toEqual([]);
    expect(extractEmails('test@example.com')).toEqual([]);
  });

  it('ignores image-looking strings', () => {
    expect(extractEmails('icon@assets.png')).toEqual([]);
  });
});

describe('isAcceptableEmail', () => {
  it('rejects noreply addresses', () => {
    expect(isAcceptableEmail('noreply@acme.com')).toBe(false);
    expect(isAcceptableEmail('do-not-reply@acme.com')).toBe(false);
  });

  it('accepts plausible support addresses', () => {
    expect(isAcceptableEmail('support@acme.com')).toBe(true);
    expect(isAcceptableEmail('help@acme.io')).toBe(true);
  });
});

describe('sameRegistrableDomain', () => {
  it('matches subdomains to root', () => {
    expect(sameRegistrableDomain('help.acme.com', 'www.acme.com')).toBe(true);
  });
  it('rejects different domains', () => {
    expect(sameRegistrableDomain('support.other.com', 'acme.com')).toBe(false);
  });
});

describe('scoreEmail', () => {
  it('boosts support-style local parts', () => {
    const a = scoreEmail('support@acme.com', 'acme.com');
    const b = scoreEmail('random@acme.com', 'acme.com');
    expect(a.hint).toBeGreaterThan(b.hint);
  });

  it('boosts same-domain matches', () => {
    const same = scoreEmail('support@acme.com', 'acme.com');
    const diff = scoreEmail('support@other.com', 'acme.com');
    expect(same.hint).toBeGreaterThan(diff.hint);
  });
});
