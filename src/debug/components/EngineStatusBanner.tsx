import type { EngineStatus } from '@/engine';
import { describeStatus, type StatusTone } from '@/lib/engine-status';

interface Props {
  readonly status: EngineStatus;
  readonly earshotAvailable: boolean | null;
}

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: 'bg-stone-100 text-stone-700 ring-stone-300',
  busy: 'bg-amber-50 text-amber-900 ring-amber-300',
  good: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
  warn: 'bg-rose-50 text-rose-900 ring-rose-300',
};

/** A single banner describing what the engine is doing, or why it is not. */
export function EngineStatusBanner({ status, earshotAvailable }: Props) {
  const { tone, title, detail } = describeStatus(status, earshotAvailable);
  return (
    <div className={`rounded-xl p-4 ring-1 ${TONE_CLASS[tone]}`} role="status" aria-live="polite">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-relaxed">{detail}</p>
    </div>
  );
}
