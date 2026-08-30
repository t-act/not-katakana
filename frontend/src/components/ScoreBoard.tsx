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
    <header className="rounded-b-block border-b border-sumi-edge bg-sumi-raised px-4 py-2.5">
      <div className="mb-2 flex items-center justify-between label text-kinari-faint">
        <span>
          {room.current_lap}周目 ・ {roundNumber}/{room.total_rounds}
        </span>
        <span className="tracking-code">{room.code}</span>
      </div>
      {/* 折り返しに任せると人数で並びが変わる。2 列に固定して名前と点の桁を揃える */}
      <ol className="grid grid-cols-2 gap-x-4 gap-y-1">
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
              {/* 印の桁は幅で空ける。全角スペースだと書体によって幅が変わる */}
              <span className="w-4 shrink-0 text-shu">{isMaster ? '説' : ''}</span>
              <span className={`truncate ${isMe ? 'text-kinari' : 'text-kinari-dim'}`}>
                {player.name}
                {isMe && <span className="text-kinari-faint">（あなた）</span>}
              </span>
              <span className="ml-auto font-mincho tabular-nums text-ai">{player.score}</span>
            </li>
          )
        })}
      </ol>
    </header>
  )
}
