import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'

import { Button } from './components/Button'
import { ScoreBoard } from './components/ScoreBoard'
import { Screen } from './components/Screen'
import { useWakeLock } from './hooks/useWakeLock'
import { LobbyScreen } from './screens/LobbyScreen'
import { NameEntryScreen } from './screens/NameEntryScreen'
import { ResultScreen } from './screens/ResultScreen'
import { RoundActiveScreen } from './screens/RoundActiveScreen'
import { RoundReadyScreen } from './screens/RoundReadyScreen'
import { RoundResultScreen } from './screens/RoundResultScreen'
import { TopScreen } from './screens/TopScreen'
import { DevIndexScreen, DevViewScreen } from './dev/DevGallery'
import { useGameStore } from './store/gameStore'
import { loadCredentials } from './ws/client'
import { FATAL_ERROR_CODES } from './ws/protocol'

const TOAST_DURATION_MS = 3200

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<TopScreen />} />
      <Route path="/r/:code" element={<RoomScreen />} />
      {import.meta.env.DEV && <Route path="/dev" element={<DevIndexScreen />} />}
      {import.meta.env.DEV && <Route path="/dev/:view" element={<DevViewScreen />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function RoomScreen() {
  const { code = '' } = useParams()
  const roomCode = code.toUpperCase()

  const room = useGameStore((s) => s.room)
  const status = useGameStore((s) => s.status)
  const error = useGameStore((s) => s.error)
  const join = useGameStore((s) => s.join)

  // 一度でも入ったことのあるルームなら名前を聞き直さない
  const [name, setName] = useState<string | null>(
    () => loadCredentials(roomCode)?.name ?? null,
  )

  useEffect(() => {
    if (name !== null) join(roomCode, name)
  }, [name, roomCode, join])

  // 説明が始まってから当たりが出るまでは画面を消させない
  useWakeLock(room?.phase === 'round_ready' || room?.phase === 'round_active')

  if (name === null) {
    return <NameEntryScreen roomCode={roomCode} onSubmit={setName} />
  }

  if (error && FATAL_ERROR_CODES.has(error.code)) {
    return <FatalError message={error.message} />
  }

  if (!room) {
    return <Connecting reconnecting={status === 'reconnecting'} />
  }

  return <RoomView />
}

/**
 * 参加が済んだあとの本編。状態は store から読むだけで、接続の世話はしない。
 * 開発用ギャラリーが同じ組みを出せるよう、join の副作用と分けている。
 */
export function RoomView() {
  const room = useGameStore((s) => s.room)!
  const status = useGameStore((s) => s.status)

  return (
    <div className="flex flex-1 flex-col">
      {status === 'reconnecting' && (
        <p className="bg-shu-deep py-1.5 text-center text-xs tracking-wider text-white">
          つなぎ直しています…
        </p>
      )}
      <ScoreBoard />
      <PhaseScreen phase={room.phase} />
      <Toast />
    </div>
  )
}

function PhaseScreen({ phase }: { phase: string }) {
  switch (phase) {
    case 'lobby':
      return <LobbyScreen />
    case 'round_ready':
      return <RoundReadyScreen />
    case 'round_active':
      return <RoundActiveScreen />
    case 'round_result':
      return <RoundResultScreen />
    case 'finished':
      return <ResultScreen />
    default:
      return null
  }
}

/** ルール違反の操作を知らせる。少し置いたら自分で消える。 */
function Toast() {
  const error = useGameStore((s) => s.error)
  const dismiss = useGameStore((s) => s.dismissError)

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(dismiss, TOAST_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [error, dismiss])

  if (!error) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <p className="animate-rise max-w-md rounded-block border border-shu bg-sumi-raised px-4 py-3 text-center text-sm text-kinari shadow-lg">
        {error.message}
      </p>
    </div>
  )
}

export function Connecting({ reconnecting }: { reconnecting: boolean }) {
  return (
    <Screen>
      <div className="flex flex-1 items-center justify-center">
        <p className="animate-urgent font-mincho text-lg tracking-[0.3em] text-kinari-faint">
          {reconnecting ? 'つなぎ直しています' : 'つないでいます'}
        </p>
      </div>
    </Screen>
  )
}

export function FatalError({ message }: { message: string }) {
  const navigate = useNavigate()
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="mb-6 font-mincho text-2xl text-shu">入れませんでした</p>
        <p className="mb-10 max-w-xs text-sm leading-7 text-kinari-dim">{message}</p>
        <Button onClick={() => navigate('/')}>はじめに戻る</Button>
      </div>
    </Screen>
  )
}
