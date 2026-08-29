import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

import { Button } from '../components/Button'
import { Heading, Screen } from '../components/Screen'
import { useGameStore, useIsHost } from '../store/gameStore'
import { LAP_CHOICES, MAX_PLAYERS, MIN_PLAYERS, TIME_LIMIT_CHOICES } from '../ws/protocol'

export function LobbyScreen() {
  const room = useGameStore((s) => s.room)!
  const send = useGameStore((s) => s.send)
  const isHost = useIsHost()
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const shareUrl = `${location.origin}/r/${room.code}`

  useEffect(() => {
    // 紙に刷ったように、白地へ墨で。真っ黒より淡いが、読み取りに要る比率は満たしている
    QRCode.toDataURL(shareUrl, {
      margin: 2,
      width: 360,
      color: { dark: '#3d3b38', light: '#ffffff' },
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [shareUrl])

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'NOT カタカナ', url: shareUrl }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(shareUrl).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const enoughPlayers = room.players.length >= MIN_PLAYERS

  return (
    <Screen>
      <Heading>あつまる</Heading>

      <div className="animate-rise mb-8 text-center">
        <p className="mb-1 text-[0.7rem] tracking-[0.3em] text-kinari-faint">合いことば</p>
        <p className="font-mincho text-4xl tracking-[0.3em] text-kinari">{room.code}</p>
        {qr && (
          <img
            src={qr}
            alt={`${room.code} に参加するための二次元コード`}
            className="mx-auto mt-5 w-44"
          />
        )}
        <Button variant="quiet" className="mt-2" onClick={share}>
          {copied ? '共有済み' : ''}
        </Button>
      </div>

      <Heading>いま {room.players.length} 人</Heading>
      <ol className="animate-rise mb-8 divide-y divide-sumi-edge border-y border-sumi-edge">
        {room.players.map((player, index) => (
          <li key={player.id} className="flex items-center gap-3 py-3">
            <span className="font-mincho text-sm text-kinari-faint">{index + 1}</span>
            <span className={`flex-1 ${player.connected ? 'text-kinari' : 'text-kinari-faint'}`}>
              {player.name}
            </span>
            {player.id === room.host_id && (
              <span className="text-[0.7rem] tracking-[0.2em] text-shu">まとめ役</span>
            )}
          </li>
        ))}
        {room.players.length < MAX_PLAYERS && (
          <li className="py-3 text-sm text-kinari-faint">
            あと {MAX_PLAYERS - room.players.length} 人まで入れます
          </li>
        )}
      </ol>

      <Heading>とりきめ</Heading>
      <div className="mb-8 space-y-5">
        <Choices
          label="ひとりの持ち時間"
          unit="秒"
          options={TIME_LIMIT_CHOICES}
          value={room.settings.time_limit_sec}
          disabled={!isHost}
          onSelect={(v) => send({ type: 'update_settings', time_limit_sec: v })}
        />
        <Choices
          label="まわす回数"
          unit="周"
          options={LAP_CHOICES}
          value={room.settings.total_laps}
          disabled={!isHost}
          onSelect={(v) => send({ type: 'update_settings', total_laps: v })}
        />
      </div>

      <div className="mt-auto">
        {isHost ? (
          <Button variant="primary" disabled={!enoughPlayers} onClick={() => send({ type: 'start_game' })}>
            {enoughPlayers ? 'はじめる' : `あと ${MIN_PLAYERS - room.players.length} 人待ちます`}
          </Button>
        ) : (
          <p className="py-4 text-center text-sm text-kinari-dim">
            まとめ役がはじめるのを待っています
          </p>
        )}
      </div>
    </Screen>
  )
}

interface ChoicesProps {
  label: string
  unit: string
  options: readonly number[]
  value: number
  disabled: boolean
  onSelect(value: number): void
}

function Choices({ label, unit, options, value, disabled, onSelect }: ChoicesProps) {
  return (
    <div>
      <p className="mb-2 text-sm text-kinari-dim">{label}</p>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option}
            disabled={disabled}
            onClick={() => onSelect(option)}
            className={`min-h-[max(3rem,44px)] flex-1 rounded-chip border text-sm transition-colors disabled:cursor-default ${
              option === value
                ? 'border-shu bg-shu/10 text-kinari'
                : 'border-sumi-edge text-kinari-faint disabled:opacity-40'
            }`}
          >
            <span className="font-mincho text-lg">{option}</span>
            <span className="ml-0.5 text-xs">{unit}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
