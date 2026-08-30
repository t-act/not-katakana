import { Button } from '../components/Button'
import { Screen } from '../components/Screen'
import { useGameStore, useIsMaster, useMaster } from '../store/gameStore'

export function RoundReadyScreen() {
  const room = useGameStore((s) => s.room)!
  const send = useGameStore((s) => s.send)
  const isMaster = useIsMaster()
  const master = useMaster()
  const masterOffline = master !== null && !master.connected

  return (
    <Screen>
      <div className="animate-rise flex flex-1 flex-col items-center justify-center text-center">
        {isMaster ? (
          <>
            <p className="mb-3 label text-shu">
              あなたの番です
            </p>
            <p className="font-mincho text-3xl leading-relaxed text-kinari">
              ことばを開いたら
              <br />
              {room.settings.time_limit_sec}秒で説明します
            </p>
            <p className="mt-6 max-w-xs text-sm leading-7 text-kinari-dim">
              カタカナを使わずに。
            </p>
          </>
        ) : (
          <>
            <p className="mb-3 label text-kinari-faint">
              つぎの説明役
            </p>
            <p className="font-mincho text-4xl text-kinari">{master?.name}</p>
            <p className="mt-6 text-sm leading-7 text-kinari-dim">
              画面ではなく、{master?.name}さんを見ていてください。
            </p>
          </>
        )}
      </div>

      <div className="mt-auto">
        {isMaster || masterOffline ? (
          <Button variant="primary" onClick={() => send({ type: 'start_round' })}>
            {isMaster ? 'ことばを開く' : `${master?.name}さんの代わりに開く`}
          </Button>
        ) : (
          <p className="py-4 text-center text-sm text-kinari-faint">まもなく始まります</p>
        )}
      </div>
    </Screen>
  )
}
