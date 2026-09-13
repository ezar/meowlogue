import type { Label } from '@/db/schema';
import type { MessageKey, Translator } from '@/i18n';

/**
 * A context label's display text.
 *
 * The nine defaults of spec 5.1 are stored as i18n keys so they follow the
 * app's language; one the user typed or renamed is shown exactly as typed,
 * because it is their word and translating it would be inventing one.
 *
 * @param label The stored label.
 * @param t The bound translator.
 */
export function labelText(label: Label, t: Translator): string {
  return label.isCustom ? label.name : t(label.name as MessageKey);
}
