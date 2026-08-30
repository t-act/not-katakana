import { useState } from 'react'

import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { NAME_MAX_LENGTH } from '../ws/protocol'

interface Props {
  roomCode: string
  onSubmit(name: string): void
}

export function NameEntryScreen({ roomCode, onSubmit }: Props) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center">
        <div className="animate-rise mb-10">
          <p className="mb-2 label text-kinari-faint">合いことば</p>
          <p className="font-mincho text-3xl tracking-code text-kinari">{roomCode}</p>
        </div>

        <form
          className="animate-rise space-y-4"
          style={{ animationDelay: '80ms' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (trimmed) onSubmit(trimmed)
          }}
        >
          <label text-kinari-faint className="block text-sm text-kinari-dim" htmlFor="player-name">
            画面に出る名前
          </label>
          <input
            id="player-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="off"
            placeholder="カタカナたろう"
            className="min-h-[max(3.5rem,52px)] w-full rounded-block border border-kinari-faint bg-transparent px-4 font-mincho text-2xl text-kinari placeholder:text-kinari-faint focus:border-kinari focus:outline-none"
          />
          {/* maxLength で打ち止めなので、上限が見えてきたときだけ数える */}
          {trimmed.length >= NAME_MAX_LENGTH - 3 && (
            <p className="text-right text-xs text-kinari-faint">
              あと{NAME_MAX_LENGTH - trimmed.length}文字
            </p>
          )}
          <Button variant="primary" type="submit" disabled={!trimmed}>
            この名前で入る
          </Button>
        </form>
      </div>
    </Screen>
  )
}
