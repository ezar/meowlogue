import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly children: ReactNode;
  /** The step that actually destroys something, as opposed to asking first. */
  readonly confirming?: boolean;
};

/**
 * An action that deletes something.
 *
 * It exists because the screenshot of the household screen showed "Quitar"
 * sitting beside "Cancelar" in identical type: one of them removes a cat and
 * every label it has collected, the other does nothing, and nothing about
 * them said which. Destructive actions get their own colour here, and the
 * confirming step gets a filled button so the point of no return is the one
 * that looks heaviest.
 */
export function DangerButton({ children, confirming = false, className = '', ...rest }: Props) {
  const look = confirming
    ? 'bg-rose-700 text-white'
    : 'text-rose-700 ring-1 ring-rose-300 bg-white/60';
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40 ${look} ${className}`}
    >
      {children}
    </button>
  );
}
