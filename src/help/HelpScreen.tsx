import { useI18n, type MessageKey } from '@/i18n';
import { ScreenShell } from '@/components/ScreenShell';

/** The privacy points, reused verbatim from onboarding rather than rewritten. */
const PRIVACY_KEYS: readonly MessageKey[] = [
  'onboarding.privacy.mic',
  'onboarding.privacy.local',
  'onboarding.privacy.clips',
  'onboarding.privacy.models',
];

/**
 * How it works, readable at any time.
 *
 * Onboarding said all of this once and then closed behind you. Rereading the
 * explanation should not cost anything — least of all the household — so this
 * is a plain screen that touches no data, and "start over" lives somewhere
 * else entirely.
 *
 * The copy is the onboarding copy, by key. Restating it here in slightly
 * different words would give the app two answers to "does it translate?", and
 * spec section 2 only allows one.
 */
export function HelpScreen() {
  const { t } = useI18n();

  return (
    <ScreenShell title={t('help.title')}>
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-stone-800">{t('help.honestyTitle')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-600">{t('help.honesty')}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-stone-800">{t('help.confidenceTitle')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-600">{t('help.confidence')}</p>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-stone-800">{t('help.privacyTitle')}</h2>
          <ul className="mt-1 space-y-2">
            {PRIVACY_KEYS.map((key) => (
              <li key={key} className="text-sm leading-relaxed text-stone-600">
                {t(key)}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-stone-800">{t('help.modelsTitle')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-600">{t('help.models')}</p>
        </section>
      </div>
    </ScreenShell>
  );
}
