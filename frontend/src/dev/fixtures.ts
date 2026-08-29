/**
 * 開発時に画面を目視するための作り話のデータ。
 * 本番の束には入らない (App.tsx で import.meta.env.DEV に閉じてある)。
 */

import type { ConnectionStatus } from '../ws/client'
import type { Player, Room, RoundOutcome, Word } from '../ws/protocol'

export interface DevFixture {
  label: string
  room: Room
  playerId: string
  status?: ConnectionStatus
  error?: { code: string; message: string }
}

const WORD: Word = {
  id: 'w1',
  word: 'エスカレーター',
  difficulty: 'normal',
  tags: ['まち'],
}

function player(id: string, name: string, score: number, order: number, connected = true): Player {
  return { id, name, score, order, connected }
}

const P1 = player('p1', 'たくと', 2, 0)
const P2 = player('p2', 'みさき', 3, 1)
const P3 = player('p3', 'ゆうた', 1, 2)
const P4 = player('p4', 'のぞみ', 3, 3, false)

const FOUR = [P1, P2, P3, P4]

/** 4 人 2 周の途中。ここから phase だけを差し替えて各画面を作る */
function room(patch: Partial<Room> = {}): Room {
  return {
    code: 'AB12CD',
    host_id: 'p1',
    settings: { time_limit_sec: 60, total_laps: 2 },
    players: FOUR,
    phase: 'lobby',
    rounds_played: 4,
    current_word: null,
    deadline_ms: null,
    used_word_ids: [],
    last_result: null,
    master_index: 0,
    current_lap: 2,
    total_rounds: 8,
    master_id: 'p1',
    ...patch,
  }
}

/** 残り秒から締切を作る。読み込むたびに数えなおすので固定値では置けない */
function deadline(sec: number): number {
  return Date.now() + sec * 1000
}

function result(outcome: RoundOutcome, answererId: string | null): Room['last_result'] {
  return { outcome, word: WORD, master_id: 'p1', answerer_id: answererId }
}

export const DEV_FIXTURES: Record<string, () => DevFixture> = {
  'lobby-host': () => ({
    label: 'あつまる（まとめ役）',
    room: room({ phase: 'lobby', rounds_played: 0, current_lap: 1 }),
    playerId: 'p1',
  }),
  'lobby-guest': () => ({
    label: 'あつまる（客）',
    room: room({ phase: 'lobby', rounds_played: 0, current_lap: 1 }),
    playerId: 'p2',
  }),
  'lobby-waiting': () => ({
    label: 'あつまる（人が足りない）',
    room: room({
      phase: 'lobby',
      players: [P1, P2],
      rounds_played: 0,
      current_lap: 1,
      total_rounds: 4,
    }),
    playerId: 'p1',
  }),
  'ready-master': () => ({
    label: '開く前（説明役）',
    room: room({ phase: 'round_ready' }),
    playerId: 'p1',
  }),
  'ready-listener': () => ({
    label: '開く前（聞く側）',
    room: room({ phase: 'round_ready' }),
    playerId: 'p2',
  }),
  'ready-master-offline': () => ({
    label: '開く前（説明役が落ちている）',
    room: room({ phase: 'round_ready', master_id: 'p4' }),
    playerId: 'p2',
  }),
  'active-master': () => ({
    label: '説明中（説明役）',
    room: room({ phase: 'round_active', current_word: WORD, deadline_ms: deadline(42) }),
    playerId: 'p1',
  }),
  'active-listener': () => ({
    label: '説明中（聞く側）',
    room: room({ phase: 'round_active', deadline_ms: deadline(42) }),
    playerId: 'p2',
  }),
  'active-listener-urgent': () => ({
    label: '説明中（残りわずか）',
    room: room({ phase: 'round_active', deadline_ms: deadline(8) }),
    playerId: 'p2',
  }),
  'result-correct': () => ({
    label: 'ラウンド結果（あたり）',
    room: room({
      phase: 'round_result',
      rounds_played: 5,
      last_result: result('correct', 'p2'),
      master_id: 'p2',
    }),
    playerId: 'p2',
  }),
  'result-timeup': () => ({
    label: 'ラウンド結果（時間切れ）',
    room: room({
      phase: 'round_result',
      rounds_played: 5,
      last_result: result('timeup', null),
      master_id: 'p2',
    }),
    playerId: 'p3',
  }),
  'result-passed': () => ({
    label: 'ラウンド結果（おてあげ）',
    room: room({
      phase: 'round_result',
      rounds_played: 5,
      last_result: result('passed', null),
      master_id: 'p2',
    }),
    playerId: 'p3',
  }),
  finished: () => ({
    label: 'おわり（まとめ役）',
    room: room({
      phase: 'finished',
      rounds_played: 8,
      players: [P1, { ...P2, score: 5 }, P3, P4],
    }),
    playerId: 'p1',
  }),
  'finished-tie': () => ({
    label: 'おわり（同点）',
    room: room({ phase: 'finished', rounds_played: 8 }),
    playerId: 'p3',
  }),
  reconnecting: () => ({
    label: 'つなぎ直し中の帯',
    room: room({ phase: 'round_ready' }),
    playerId: 'p2',
    status: 'reconnecting',
  }),
  toast: () => ({
    label: '注意書き（トースト）',
    room: room({ phase: 'round_ready' }),
    playerId: 'p2',
    error: { code: 'not_master', message: 'いまは説明役だけが進められます' },
  }),
}
