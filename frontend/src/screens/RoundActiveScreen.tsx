import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { TimerBar } from '../components/TimerBar'
import { useTimer } from '../hooks/useCountdown'
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

      {/* 時間とお題をひと塊にして上へ。空きは操作との間に落として読む順を作る */}
      <div className="flex flex-1 flex-col items-center pt-14">
        <p className="mb-4 label text-kinari-faint">おだい</p>
        {/* 折り返すと目が二度動く。語彙の最長 9 文字が 1 行に収まる大きさで刷る */}
        <p
          key={room.current_word?.id}
          className="animate-press-in text-center font-mincho font-black text-odai leading-tight text-kinari"
        >
          {room.current_word?.word ?? '…'}
        </p>
      </div>

      <div>
        <p className="mb-2.5 label text-kinari-faint">当てた人を押してください</p>
        <div className="grid grid-cols-2 gap-2.5">
          {others.map((player) => (
            <button
              key={player.id}
              onClick={() => send({ type: 'answer_correct', answerer_id: player.id })}
              className="min-h-[max(4rem,60px)] rounded-block border border-kinari-faint px-3 font-mincho text-xl text-kinari transition-colors active:border-shu active:bg-shu/15"
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
  const { remainingSec, ratio, urgent } = useTimer(
    room.deadline_ms,
    room.settings.time_limit_sec,
    offset,
  )

  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="mb-8 text-center font-mincho text-2xl text-kinari">{master?.name}さんの説明</p>

        <p
          className={`font-mincho font-black text-[6.5rem] leading-none tabular-nums ${
            urgent ? 'text-shu animate-urgent' : 'text-kinari'
          }`}
        >
          {Math.ceil(remainingSec)}
        </p>
        <p className="mt-2 text-sm text-kinari-faint">秒</p>

        <div className="mt-10 h-1 w-40 overflow-hidden rounded-full bg-sumi-edge">
          <div
            className={`h-full origin-left ${urgent ? 'bg-shu' : 'bg-kinari-dim'}`}
            style={{ transform: `scaleX(${ratio})` }}
          />
        </div>

        <p className="mt-12 max-w-[16rem] text-center text-sm leading-7 text-kinari-dim">
          わかったら声に出してください。
          <br />
          カタカナが出たら、その場で指摘を。
        </p>
      </div>
    </Screen>
  )
}
