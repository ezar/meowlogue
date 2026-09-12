import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { readonly children: ReactNode };

/** A step's lesser action: going back, skipping. */
export function SecondaryButton({ children, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-xl px-5 py-3 text-base font-medium text-stone-700 transition-opacity disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
