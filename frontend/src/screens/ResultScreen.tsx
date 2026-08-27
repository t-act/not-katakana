import { useNavigate } from 'react-router-dom'

import { Button } from '../components/Button'
import { Heading, Screen } from '../components/Screen'
import { rankPlayers, useGameStore, useIsHost } from '../store/gameStore'

export function ResultScreen() {
  const room = useGameStore((s) => s.room)!
  const playerId = useGameStore((s) => s.playerId)
  const send = useGameStore((s) => s.send)
  const leave = useGameStore((s) => s.leave)
  const isHost = useIsHost()
  const navigate = useNavigate()

  const ranked = rankPlayers(room.players)
  const topScore = ranked[0]?.score ?? 0
  const winners = ranked.filter((p) => p.score === topScore)

  return (
    <Screen>
      <div className="animate-rise mb-10 pt-6 text-center">
        <p className="mb-4 text-[0.7rem] tracking-[0.35em] text-kinari-faint">
          {room.settings.total_laps}周 おわり
        </p>
        <p className="font-mincho font-black text-[2.5rem] leading-tight text-kin">
          {winners.map((w) => w.name).join('・')}
        </p>
        <p className="mt-3 text-sm text-kinari-dim">
          {winners.length > 1 ? 'ならびました' : 'のかち'}
        </p>
      </div>

      <Heading>てんすう</Heading>
      <ol className="mb-8 divide-y divide-sumi-edge border-y border-sumi-edge">
        {ranked.map((player) => {
          const rank = ranked.findIndex((p) => p.score === player.score) + 1
          return (
            <li key={player.id} className="flex items-center gap-3 py-3.5">
              <span
                className={`w-6 font-mincho text-lg ${
                  player.score === topScore ? 'text-kin' : 'text-kinari-faint'
                }`}
              >
                {rank}
              </span>
              <span className={`flex-1 ${player.id === playerId ? 'text-kinari' : 'text-kinari-dim'}`}>
                {player.name}
                {player.id === playerId && <span className="text-kinari-faint">（あなた）</span>}
              </span>
              <span className="font-mincho text-xl tabular-nums text-kinari">{player.score}</span>
              <span className="text-xs text-kinari-faint">点</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-auto space-y-3">
        {isHost && (
          <Button variant="primary" onClick={() => send({ type: 'restart_game' })}>
            同じ顔ぶれでもう一度
          </Button>
        )}
        <Button
          variant="quiet"
          onClick={() => {
            leave(room.code)
            navigate('/')
          }}
        >
          ここで終わる
        </Button>
      </div>
    </Screen>
  )
}
