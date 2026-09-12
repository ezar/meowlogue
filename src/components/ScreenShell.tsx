import type { ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { navigate } from '@/lib/route';

interface Props {
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * Frame for a screen reached from the app rather than from onboarding:
 * a way back, a heading, and the content.
 *
 * The back control navigates rather than calling `history.back()`. Going back
 * in history from a screen someone opened directly — a bookmarked `#/help`,
 * or the first tap after a cold start — leaves the app, which is not what a
 * back arrow inside the app should ever do.
 */
export function ScreenShell({ title, children }: Props) {
  const { t } = useI18n();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-6">
      <nav>
        <button
          type="button"
          onClick={() => {
            navigate('home');
          }}
          className="-ml-1 rounded-lg px-1 py-1 text-sm font-medium text-stone-600"
        >
          ← {t('nav.back')}
        </button>
      </nav>
      <h1 className="mt-3 text-2xl font-semibold leading-tight text-stone-900">{title}</h1>
      <div className="mt-4 flex-1">{children}</div>
    </main>
  );
}
