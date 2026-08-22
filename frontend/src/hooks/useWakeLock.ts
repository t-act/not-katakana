import { useEffect } from 'react'

/**
 * 有効な間、端末の画面を消させない。
 *
 * お題を映しているマスターの画面が暗転すると場が止まる。対応していない
 * 端末では黙って何もしない。
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let released = false

    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        // 電池残量が少ないと拒否される。遊べなくなるわけではないので黙って諦める
      }
    }

    // 画面を切り替えて戻ると解除されているので取り直す
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !released) void acquire()
    }

    void acquire()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinel?.release()
    }
  }, [active])
}
