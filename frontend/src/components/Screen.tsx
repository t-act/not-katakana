import type { ReactNode } from 'react'

/** 画面の外枠。上下の余白と最大幅をここで一括して決める。 */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {children}
    </main>
  )
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="rule-heading mb-5 font-mincho text-sm tracking-label text-kinari-dim">
      {children}
    </h2>
  )
}
