/**
 * 開発用の画面一覧。作り話の状態を store に流し込んで、本番と同じ組みを出す。
 * サーバーもタイマーも要らないので、配色や字組みだけを続けて見比べられる。
 */

import { useRef } from 'react'
import type { ReactElement } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { Connecting, FatalError, RoomView } from '../App'
import { NameEntryScreen } from '../screens/NameEntryScreen'
import { TopScreen } from '../screens/TopScreen'
import { useGameStore } from '../store/gameStore'
import { DEV_FIXTURES } from './fixtures'

/** store を使わない画面。作り話を流し込む必要がないので直に置く */
const STANDALONE: Record<string, { label: string; element: () => ReactElement }> = {
  top: { label: 'はじめ', element: () => <TopScreen /> },
  'name-entry': {
    label: '名前を入れる',
    element: () => <NameEntryScreen roomCode="AB12CD" onSubmit={() => {}} />,
  },
  connecting: { label: 'つないでいます', element: () => <Connecting reconnecting={false} /> },
  'connecting-again': {
    label: 'つなぎ直しています',
    element: () => <Connecting reconnecting={true} />,
  },
  'fatal-error': {
    label: '入れなかった',
    element: () => <FatalError message="もう始まっています" />,
  },
}

export function DevIndexScreen() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-10">
      <h1 className="mb-2 font-mincho text-2xl text-kinari">画面一覧</h1>
      <p className="mb-8 text-xs leading-6 text-kinari-faint">
        開発中だけ出る目視用の索引です。作り話の値で描いています。
      </p>

      <Section title="接続まわり" keys={Object.keys(STANDALONE)} labels={STANDALONE} />
      <Section
        title="本編"
        keys={Object.keys(DEV_FIXTURES)}
        labels={Object.fromEntries(
          Object.entries(DEV_FIXTURES).map(([key, make]) => [key, { label: make().label }]),
        )}
      />
    </main>
  )
}

function Section({
  title,
  keys,
  labels,
}: {
  title: string
  keys: string[]
  labels: Record<string, { label: string }>
}) {
  return (
    <section className="mb-8">
      <h2 className="rule-heading mb-3 label text-kinari-faint">
        {title}
      </h2>
      <ol className="divide-y divide-sumi-edge border-y border-sumi-edge">
        {keys.map((key) => (
          <li key={key}>
            <Link
              to={`/dev/${key}`}
              className="flex items-baseline justify-between gap-3 py-3 text-sm text-kinari"
            >
              <span>{labels[key].label}</span>
              <span className="label text-kinari-faint font-mono">{key}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function DevViewScreen() {
  const { view = '' } = useParams()
  // 名前が変わったら作り直す。effect で流し込むと 1 フレーム空の store が描かれてしまう
  return <DevView key={view} name={view} />
}

function DevView({ name }: { name: string }) {
  const standalone = STANDALONE[name]
  const make = DEV_FIXTURES[name]

  // 子が store を読む前に流し込む。effect にすると 1 フレーム空の状態が描かれてしまう
  const seeded = useRef(false)
  if (make && !seeded.current) {
    seeded.current = true
    const fixture = make()
    useGameStore.setState({
      room: fixture.room,
      playerId: fixture.playerId,
      status: fixture.status ?? 'open',
      error: fixture.error ?? null,
      serverOffsetMs: 0,
    })
  }

  if (!standalone && !make) return <Navigate to="/dev" replace />

  return (
    <>
      {standalone ? standalone.element() : <RoomView />}
      <Link
        to="/dev"
        className="fixed right-2 bottom-2 z-50 rounded-chip bg-sumi-raised px-2 py-1 font-mono text-[0.65rem] text-kinari-faint opacity-70"
      >
        一覧
      </Link>
    </>
  )
}
