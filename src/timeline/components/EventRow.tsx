import type { Cat, StoredEvent } from '@/db/schema';
import { useI18n, type MessageKey } from '@/i18n';
import { catColorById } from '@/lib/cat-colors';
import { formatDuration } from '@/lib/format';
import { navigate } from '@/lib/route';

interface Props {
  readonly event: StoredEvent;
  readonly cats: readonly Cat[];
}

/** One row in the timeline: when, what, who, and a way in. */
export function EventRow({ event, cats }: Props) {
  const { t, locale } = useI18n();
  const cat = cats.find((one) => one.id === event.catId);
  const time = new Date(event.startedAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          navigate({ kind: 'event', id: event.id });
        }}
        className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left ring-1 ring-stone-200"
      >
        <span className="w-12 shrink-0 text-sm tabular-nums text-stone-500">{time}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-stone-900">
            {t(`type.${event.type}` as MessageKey)}
          </span>
          <span className="block text-xs text-stone-500 tabular-nums">
            {formatDuration(event.durationMs)}
          </span>
        </span>
        {event.notACat === true ? (
          <span className="shrink-0 text-xs text-stone-500">{t('timeline.stateNotACat')}</span>
        ) : cat === undefined ? (
          // Spec 5.1: an unconfirmed card keeps a subtle "?" badge.
          <span className="shrink-0 text-xs text-stone-400" aria-label={t('event.unconfirmed')}>
            ?
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 text-sm text-stone-700">
            <span
              aria-hidden="true"
              className="size-3 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: catColorById(cat.color).hex }}
            />
            {cat.name}
          </span>
        )}
      </button>
    </li>
  );
}
