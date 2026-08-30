import { useEffect, useState } from 'react'

/**
 * 締切までの残り秒を返す。
 *
 * サーバーは残り時間ではなく絶対時刻の締切を配ってくる。端末ごとの時計のずれは
 * offsetMs で吸収する。並べて置いた画面の数字が食い違うと対面では興ざめするため。
 */
export function useCountdown(deadlineMs: number | null, offsetMs: number): number {
  const [remainingSec, setRemainingSec] = useState(0)

  useEffect(() => {
    if (deadlineMs === null) {
      setRemainingSec(0)
      return
    }

    let frame = 0
    const tick = () => {
      const remaining = Math.max(0, (deadlineMs - (Date.now() + offsetMs)) / 1000)
      // 0.1 秒より細かい変化は捨てる。表示は秒単位、棒も 10Hz で十分なめらかなのに、
      // 毎フレーム流すと説明中 (画面消灯も止めている) だけ木全体を毎秒 60 回描き直すことになる
      setRemainingSec((prev) => (Math.abs(prev - remaining) < 0.1 ? prev : remaining))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [deadlineMs, offsetMs])

  return remainingSec
}

/** 締切が近いとみなす割合。ここを跨いだら数字を朱に振る */
const URGENT_RATIO = 0.25

/**
 * 残り時間と、その読み方。
 * 説明役と聞く側で見せ方は違うが、切迫の判定まで別々に持つと片方だけずれる。
 */
export function useTimer(deadlineMs: number | null, totalSec: number, offsetMs: number) {
  const remainingSec = useCountdown(deadlineMs, offsetMs)
  const ratio = totalSec > 0 ? Math.min(1, Math.max(0, remainingSec / totalSec)) : 0
  return { remainingSec, ratio, urgent: ratio <= URGENT_RATIO }
}
