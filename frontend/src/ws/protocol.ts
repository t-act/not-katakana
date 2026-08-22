/**
 * サーバーとやり取りするメッセージの形。
 * backend/src/models.py と対になっているので、片方を変えたら両方を直す。
 */

export type Phase = 'lobby' | 'round_ready' | 'round_active' | 'round_result' | 'finished'
export type RoundOutcome = 'correct' | 'timeup' | 'passed'
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface Word {
  id: string
  word: string
  difficulty: Difficulty
  tags: string[]
}

export interface Player {
  id: string
  name: string
  score: number
  order: number
  connected: boolean
}

export interface RoomSettings {
  time_limit_sec: number
  total_laps: number
}

export interface RoundResult {
  outcome: RoundOutcome
  word: Word
  master_id: string
  answerer_id: string | null
}

export interface Room {
  code: string
  host_id: string
  settings: RoomSettings
  players: Player[]
  phase: Phase
  rounds_played: number
  /** マスターの端末にしか入らない。他の接続には最初から載っていない */
  current_word: Word | null
  deadline_ms: number | null
  used_word_ids: string[]
  last_result: RoundResult | null
  master_index: number
  current_lap: number
  total_rounds: number
  master_id: string | null
}

export type ServerMessage =
  | { type: 'joined'; player_id: string; token: string; server_time_ms: number }
  | { type: 'state'; room: Room }
  | { type: 'error'; code: string; message: string }

export type ClientMessage =
  | { type: 'update_settings'; time_limit_sec?: number; total_laps?: number }
  | { type: 'start_game' }
  | { type: 'start_round' }
  | { type: 'answer_correct'; answerer_id: string }
  | { type: 'pass_round' }
  | { type: 'next_round' }
  | { type: 'restart_game' }

/** 参加そのものを断られた合図。再接続しても結果は変わらない */
export const FATAL_ERROR_CODES = new Set([
  'bad_token',
  'room_full',
  'game_started',
  'invalid_name',
])

export const TIME_LIMIT_CHOICES = [30, 60, 90, 120] as const
export const LAP_CHOICES = [1, 2, 3, 4, 5] as const
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 6
export const NAME_MAX_LENGTH = 12
