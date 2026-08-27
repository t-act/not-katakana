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
        <div className="animate-rise mb-14 border-l-2 border-shu pl-5">
          <h1 className="font-mincho font-black text-5xl leading-[1.15] tracking-tight text-kinari">
            カタカナ
            <br />
            抜き
          </h1>
          <p className="mt-5 text-sm leading-7 text-kinari-dim">
            出たことばを、カタカナを使わずに説明する。
            <br />
            まわりの人が言い当てたら、その人に一点。
          </p>
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
              className="min-h-[max(3.5rem,52px)] min-w-0 flex-1 border border-kinari-faint bg-transparent px-4 text-center font-mincho text-2xl tracking-[0.3em] text-kinari placeholder:text-kinari-faint focus:border-kinari focus:outline-none"
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

      <p className="mt-10 text-center text-[0.7rem] leading-5 text-kinari-faint">
        同じ場所に集まって遊ぶための道具です。
        <br />
        説明も回答も、声でどうぞ。
      </p>
    </Screen>
  )
}
