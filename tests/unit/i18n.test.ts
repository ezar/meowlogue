import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, translate } from '@/i18n';
import { es } from '@/i18n/es';
import { en } from '@/i18n/en';
import { CAT_COLORS } from '@/lib/cat-colors';
import { DEFAULT_LABEL_KEYS } from '@/db/schema';

describe('dictionaries', () => {
  it('defaults to Spanish (spec section 7)', () => {
    expect(DEFAULT_LOCALE).toBe('es');
  });

  it('covers the same keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('has no blank messages in either language', () => {
    for (const [key, value] of Object.entries({ ...es })) {
      expect(value.trim(), `es:${key}`).not.toBe('');
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en:${key}`).not.toBe('');
    }
  });

  it('translates every palette colour and every default label', () => {
    // A missing key renders as the key itself, which would be visible to the
    // user; these two sets are generated from data, so they are easy to miss.
    for (const color of CAT_COLORS) {
      expect(es, color.nameKey).toHaveProperty(color.nameKey);
      expect(en, color.nameKey).toHaveProperty(color.nameKey);
    }
    for (const key of DEFAULT_LABEL_KEYS) {
      expect(es, key).toHaveProperty(key);
      expect(en, key).toHaveProperty(key);
    }
  });

  it('says outright that it does not translate cat language', () => {
    // Honest framing is a product principle, so it is worth a test: the
    // welcome copy must not quietly lose this.
    expect(es['onboarding.welcome.body']).toMatch(/no traduce/i);
    expect(en['onboarding.welcome.body']).toMatch(/does not translate/i);
  });
});

describe('translate', () => {
  it('returns the message for a known key', () => {
    expect(translate('es', 'onboarding.welcome.cta')).toBe('Empezar');
    expect(translate('en', 'onboarding.welcome.cta')).toBe('Get started');
  });

  it('fills placeholders', () => {
    expect(translate('es', 'onboarding.step', { current: 2, total: 3 })).toBe('Paso 2 de 3');
    expect(translate('en', 'onboarding.step', { current: 1, total: 3 })).toBe('Step 1 of 3');
  });

  it('leaves a placeholder alone when no value is given', () => {
    expect(translate('en', 'onboarding.step', { current: 1 })).toContain('{total}');
  });

  it('ignores extra values', () => {
    expect(translate('es', 'onboarding.welcome.cta', { unused: 'x' })).toBe('Empezar');
  });
});
