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
      const remaining = (deadlineMs - (Date.now() + offsetMs)) / 1000
      setRemainingSec(Math.max(0, remaining))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [deadlineMs, offsetMs])

  return remainingSec
}
