import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { Screen } from '../components/Screen'

const CODE_LENGTH = 6
const CODE_ALPHABET = /[^0-9ABCDEFGHJKMNPQRSTVWXYZ]/g

export function TopScreen() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createRoom = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/rooms', { method: 'POST' })
      if (!response.ok) throw new Error(String(response.status))
      const { code: newCode } = (await response.json()) as { code: string }
      navigate(`/r/${newCode}`)
    } catch {
      setError('ルームを作れませんでした。通信を確かめてもう一度お試しください')
      setBusy(false)
    }
  }

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center">
        <div className="animate-rise mb-14 border-shu pl-5">
          {/* 題字はアイコンと同じ仕草で打ち消す。斜線は inline-block の箱の対角に引く */}
          <div className="relative inline-block">
            <h1 className="font-mincho font-black text-5xl leading-[1.15] tracking-tight text-kinari">
              NOT
              <br />
              カタカナ
            </h1>
            {/*
             * 太さを字の大きさに揃えたいので non-scaling-stroke。
             * preserveAspectRatio を切ると縦横で伸び方が変わり、線だけ歪むため。
             * svg は既定の 300x150 を持つので、inset だけでは箱に追従しない。
             */}
            <svg
              className="pointer-events-none absolute -inset-x-2 -inset-y-1 h-[calc(100%+0.5rem)] w-[calc(100%+1rem)]"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <line
                x1="0"
                y1="0"
                x2="100"
                y2="100"
                className="stroke-shu"
                strokeWidth="6"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>

        <div className="animate-rise space-y-3" style={{ animationDelay: '80ms' }}>
          <Button variant="primary" onClick={createRoom} disabled={busy}>
            {busy ? '用意しています…' : 'あたらしく始める'}
          </Button>

          <div className="rule-heading pt-6 pb-1 text-[0.7rem] tracking-[0.3em] text-kinari-faint">
            さそわれた人はこちら
          </div>

          <div className="flex gap-2.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(CODE_ALPHABET, ''))}
              maxLength={CODE_LENGTH}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="AB12CD"
              aria-label="合いことば"
              className="min-h-[max(3.5rem,52px)] min-w-0 flex-1 rounded-block border border-kinari-faint bg-transparent px-4 text-center font-mincho text-2xl tracking-[0.3em] text-kinari placeholder:text-kinari-faint focus:border-kinari focus:outline-none"
            />
            <div className="w-24 shrink-0">
              <Button
                disabled={code.length !== CODE_LENGTH}
                onClick={() => navigate(`/r/${code}`)}
              >
                入る
              </Button>
            </div>
          </div>
        </div>

        {error && <p className="mt-5 text-sm leading-6 text-shu">{error}</p>}
      </div>

    </Screen>
  )
}
