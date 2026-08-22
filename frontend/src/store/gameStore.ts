/**
 * サーバーから届いた状態をそのまま保持する。
 * 画面はここを読むだけで、勝敗も得点も自前では計算しない。
 */

import { create } from 'zustand'

import { GameConnection, clearCredentials, type ConnectionStatus } from '../ws/client'
import type { ClientMessage, Player, Room } from '../ws/protocol'

let connection: GameConnection | null = null

interface GameStore {
  room: Room | null
  playerId: string | null
  status: ConnectionStatus | 'idle'
  error: { code: string; message: string } | null
  /** サーバー時刻 − 端末時刻。締切の残りを求めるときに足して使う */
  serverOffsetMs: number

  join(roomCode: string, name: string): void
  send(message: ClientMessage): void
  leave(roomCode: string): void
  dismissError(): void
}

export const useGameStore = create<GameStore>((set) => ({
  room: null,
  playerId: null,
  status: 'idle',
  error: null,
  serverOffsetMs: 0,

  join(roomCode, name) {
    connection?.close()
    set({ status: 'connecting', error: null })

    connection = new GameConnection(roomCode, name, {
      onStatus: (status) => set({ status }),
      onMessage: (message) => {
        if (message.type === 'joined') {
          set({
            playerId: message.player_id,
            serverOffsetMs: message.server_time_ms - Date.now(),
            error: null,
          })
        } else if (message.type === 'state') {
          set({ room: message.room })
        } else if (message.type === 'error') {
          set({ error: { code: message.code, message: message.message } })
        }
      },
    })
    connection.open()
  },

  send(message) {
    connection?.send(message)
  },

  leave(roomCode) {
    connection?.close()
    connection = null
    clearCredentials(roomCode)
    set({ room: null, playerId: null, status: 'idle', error: null })
  },

  dismissError() {
    set({ error: null })
  },
}))

export function useMe(): Player | null {
  return useGameStore((s) => s.room?.players.find((p) => p.id === s.playerId) ?? null)
}

export function useIsMaster(): boolean {
  return useGameStore((s) => s.room !== null && s.room.master_id === s.playerId)
}

export function useIsHost(): boolean {
  return useGameStore((s) => s.room !== null && s.room.host_id === s.playerId)
}

export function useMaster(): Player | null {
  return useGameStore((s) => s.room?.players.find((p) => p.id === s.room?.master_id) ?? null)
}

/** 得点の高い順。同点は参加順で並べて、順位の見た目を安定させる */
export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => b.score - a.score || a.order - b.order)
}
