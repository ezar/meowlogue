import { useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, I18nContext, translate, type Locale } from './index';

interface Props {
  readonly children: ReactNode;
  /** Overrides the default, for tests and for the language setting in M2. */
  readonly locale?: Locale;
}

/**
 * Supplies the translator.
 *
 * Spanish unconditionally, because that is what spec section 7 means by
 * "Spanish default, English second" — not "whatever the browser asks for".
 * Browser negotiation was tried first and the end-to-end test caught it: on an
 * en-US Chromium the app opened in English, which is not what the spec says
 * and not what the design deliverables (section 10, mockups in Spanish) assume.
 *
 * The language setting in spec section 5.2 is what changes it, by passing
 * `locale` once that screen exists.
 */
export function I18nProvider({ children, locale = DEFAULT_LOCALE }: Props) {
  const value = useMemo(
    () => ({
      locale,
      t: (key: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) =>
        translate(locale, key, values),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
