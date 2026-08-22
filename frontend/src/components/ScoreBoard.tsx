import { rankPlayers, useGameStore } from '../store/gameStore'

/**
 * 全画面に居座る帯。得点と「あと何ラウンドか」を常に見せる。
 * 周回制では残りラウンド数が勝負の読みに直結するので、得点と同じ格で置いている。
 */
export function ScoreBoard() {
  const room = useGameStore((s) => s.room)
  const playerId = useGameStore((s) => s.playerId)
  if (!room || room.phase === 'lobby' || room.phase === 'finished') return null

  const roundNumber = Math.min(room.rounds_played + 1, room.total_rounds)

  return (
    <header className="border-b border-sumi-edge bg-sumi-raised/60 px-4 py-2.5 backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between text-[0.7rem] tracking-[0.2em] text-kinari-faint">
        <span>
          {room.current_lap}周目 ・ {roundNumber}/{room.total_rounds}
        </span>
        <span className="tracking-[0.3em]">{room.code}</span>
      </div>
      <ol className="flex flex-wrap gap-x-4 gap-y-1.5">
        {rankPlayers(room.players).map((player) => {
          const isMaster = player.id === room.master_id
          const isMe = player.id === playerId
          return (
            <li
              key={player.id}
              className={`flex items-baseline gap-1.5 text-sm ${
                player.connected ? '' : 'opacity-35'
              }`}
            >
              <span className={isMaster ? 'text-shu' : 'text-kinari-faint'}>
                {isMaster ? '説' : '　'}
              </span>
              <span className={isMe ? 'text-kinari' : 'text-kinari-dim'}>
                {player.name}
                {isMe && <span className="text-kinari-faint">（あなた）</span>}
              </span>
              <span className="font-mincho tabular-nums text-kin">{player.score}</span>
            </li>
          )
        })}
      </ol>
    </header>
  )
}
