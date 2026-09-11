import { createContext, useContext } from 'react';
import { en } from './en';
import { es, type MessageKey } from './es';

/**
 * Translation.
 *
 * Dictionaries only, no library: spec section 7 asks for Spanish first and
 * English second, and nothing here needs plural rules beyond one special case
 * or runtime locale negotiation.
 */

export type Locale = 'es' | 'en';

/** Spanish is the default (spec section 7). */
export const DEFAULT_LOCALE: Locale = 'es';

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { es, en };

/** Values substituted into a message's `{placeholders}`. */
export type MessageValues = Readonly<Record<string, string | number>>;

/**
 * Looks a message up and fills its placeholders.
 *
 * A missing key returns the key itself rather than throwing or showing an
 * empty string: a visible `onboarding.cats.title` in the UI is a bug report,
 * whereas blank space hides the problem.
 *
 * @param locale Which dictionary to read.
 * @param key The message key.
 * @param values Replacements for `{name}` placeholders.
 */
export function translate(locale: Locale, key: MessageKey, values?: MessageValues): string {
  const message = DICTIONARIES[locale][key] as string | undefined;
  if (message === undefined) return key;
  if (values === undefined) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

/** A bound translator. */
export type Translator = (key: MessageKey, values?: MessageValues) => string;

export interface I18nContextValue {
  readonly locale: Locale;
  readonly t: Translator;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key, values) => translate(DEFAULT_LOCALE, key, values),
});

/** Reads the current locale and translator. */
export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export type { MessageKey };
