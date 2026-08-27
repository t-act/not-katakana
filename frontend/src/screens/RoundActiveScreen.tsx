import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { TimerBar } from '../components/TimerBar'
import { useCountdown } from '../hooks/useCountdown'
import { useGameStore, useIsMaster, useMaster } from '../store/gameStore'

export function RoundActiveScreen() {
  return useIsMaster() ? <MasterView /> : <ListenerView />
}

/** 説明する側。お題を最大に、操作は指の届く下半分に集める。 */
function MasterView() {
  const room = useGameStore((s) => s.room)!
  const send = useGameStore((s) => s.send)
  const offset = useGameStore((s) => s.serverOffsetMs)
  const others = room.players.filter((p) => p.id !== room.master_id)

  return (
    <Screen>
      <TimerBar
        deadlineMs={room.deadline_ms}
        totalSec={room.settings.time_limit_sec}
        offsetMs={offset}
        compact
      />

      <div className="flex flex-1 flex-col items-center justify-center py-10">
        <p className="mb-4 text-[0.7rem] tracking-[0.35em] text-kinari-faint">おだい</p>
        <p
          key={room.current_word?.id}
          className="animate-press-in text-center font-mincho font-black text-[2.75rem] leading-tight tracking-tight text-kinari"
        >
          {room.current_word?.word ?? '…'}
        </p>
        <div className="mt-6 h-px w-16 bg-shu" />
      </div>

      <div>
        <p className="mb-2.5 text-[0.7rem] tracking-[0.25em] text-kinari-faint">
          当てた人を押してください
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {others.map((player) => (
            <button
              key={player.id}
              onClick={() => send({ type: 'answer_correct', answerer_id: player.id })}
              className="min-h-[max(4rem,60px)] border border-kinari-faint px-3 font-mincho text-xl text-kinari transition-colors active:border-shu active:bg-shu/15"
            >
              {player.name}
            </button>
          ))}
        </div>
        <Button variant="quiet" className="mt-3" onClick={() => send({ type: 'pass_round' })}>
          説明をあきらめる
        </Button>
      </div>
    </Screen>
  )
}

/**
 * 聞く側。押すものを何も置いていない。
 * かたかなを使ったかどうかは、その場で声に出して指摘すればよい。
 */
function ListenerView() {
  const room = useGameStore((s) => s.room)!
  const offset = useGameStore((s) => s.serverOffsetMs)
  const master = useMaster()
  const remaining = useCountdown(room.deadline_ms, offset)
  const ratio = remaining / room.settings.time_limit_sec
  const urgent = ratio <= 0.25

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="mb-8 text-center font-mincho text-2xl text-kinari">
          {master?.name}さんの説明
        </p>

        <p
          className={`font-mincho font-black text-[6.5rem] leading-none tabular-nums ${
            urgent ? 'text-shu animate-urgent' : 'text-kinari'
          }`}
        >
          {Math.ceil(remaining)}
        </p>
        <p className="mt-2 text-sm text-kinari-faint">秒</p>

        <div className="mt-10 h-1 w-40 bg-sumi-edge">
          <div
            className={`h-full origin-left ${urgent ? 'bg-shu' : 'bg-kinari-dim'}`}
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, ratio))})` }}
          />
        </div>

        <p className="mt-12 max-w-[16rem] text-center text-sm leading-7 text-kinari-dim">
          わかったら声に出してください。
          <br />
          かたかなが出たら、その場で指摘を。
        </p>
      </div>
    </Screen>
  )
}
