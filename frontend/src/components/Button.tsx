import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'outline' | 'quiet'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-shu-deep text-white border-shu-deep active:bg-shu-press active:border-shu-press',
  outline: 'bg-transparent text-kinari border-kinari-faint active:bg-sumi-raised',
  quiet: 'bg-transparent text-kinari-dim border-transparent active:text-kinari',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

/** 対面で回し見るので、指の腹で押せる高さ (56px 以上) を最低線にしている。 */
export function Button({ variant = 'outline', children, className = '', ...rest }: Props) {
  return (
    <button
      className={`min-h-[max(3.5rem,52px)] w-full rounded-block border px-5 py-3.5 text-base tracking-wide transition-colors duration-150 disabled:opacity-35 ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
