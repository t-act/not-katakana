import { useTimer } from '../hooks/useCountdown'

interface Props {
  deadlineMs: number | null
  totalSec: number
  offsetMs: number
  /** 数字を大きく出すか。マスターの画面だけ控えめにして、お題に主役を譲る */
  compact?: boolean
}

/**
 * 残り時間。数字と長さの両方で伝える。
 * 色だけに頼ると、離れた席から斜めに覗いたときに読み取れない。
 */
export function TimerBar({ deadlineMs, totalSec, offsetMs, compact = false }: Props) {
  const { remainingSec, ratio, urgent } = useTimer(deadlineMs, totalSec, offsetMs)

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label text-kinari-faint">のこり</span>
        <span
          className={`font-mincho tabular-nums leading-none ${compact ? 'text-3xl' : 'text-5xl'} ${
            urgent ? 'text-shu animate-urgent' : 'text-kinari'
          }`}
        >
          {Math.ceil(remainingSec)}
          <span className="ml-1 text-base text-kinari-dim">秒</span>
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-sumi-edge">
        <div
          className={`h-full origin-left ${urgent ? 'bg-shu' : 'bg-kinari-dim'}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  )
}
