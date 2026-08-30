import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { useGameStore } from '../store/gameStore'
import type { RoundOutcome } from '../ws/protocol'

const OUTCOME_LABEL: Record<RoundOutcome, string> = {
  correct: 'あたり',
  timeup: '時間切れ',
  passed: 'おてあげ',
}

export function RoundResultScreen() {
  const room = useGameStore((s) => s.room)!
  const playerId = useGameStore((s) => s.playerId)
  const send = useGameStore((s) => s.send)

  const result = room.last_result
  if (!result) return null

  const answerer = room.players.find((p) => p.id === result.answerer_id)
  const previousMaster = room.players.find((p) => p.id === result.master_id)
  const nextMaster = room.players.find((p) => p.id === room.master_id)
  const canAdvance = room.master_id === playerId || (nextMaster != null && !nextMaster.connected)

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-9 flex h-24 w-24 items-center justify-center">
          {result.outcome === 'correct' ? (
            <>
              <span className="animate-seal absolute inset-0 rounded-full border-[3px] border-shu" />
              {/* 印は字が枠いっぱいに来て初めて印に見える。円 96px に字 48px */}
              <span className="animate-seal font-mincho font-black text-5xl leading-none text-shu">
                当
              </span>
            </>
          ) : (
            <span className="animate-rise font-mincho text-xl tracking-label text-kinari-faint">
              {OUTCOME_LABEL[result.outcome]}
            </span>
          )}
        </div>

        <p className="mb-3 label text-kinari-faint">おだいは</p>
        <p className="animate-press-in font-mincho font-black text-odai leading-tight text-kinari">
          {result.word.word}
        </p>

        <p className="mt-9 text-sm leading-7 text-kinari-dim">
          {result.outcome === 'correct' ? (
            <>
              <span className="text-kinari">{answerer?.name}</span>さんが当てました
              <span className="ml-2 font-mincho text-ai">+1</span>
            </>
          ) : (
            <>{previousMaster?.name}さんの説明でした</>
          )}
        </p>
      </div>

      <div className="mt-auto">
        <p className="mb-3 text-center text-sm text-kinari-dim">
          つぎの説明役は<span className="text-kinari">{nextMaster?.name}</span>さん
        </p>
        {canAdvance ? (
          <Button variant="primary" onClick={() => send({ type: 'next_round' })}>
            つづける
          </Button>
        ) : (
          <p className="py-4 text-center text-sm text-kinari-faint">
            {nextMaster?.name}さんが進めるのを待っています
          </p>
        )}
      </div>
    </Screen>
  )
}
