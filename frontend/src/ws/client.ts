/**
 * WebSocket 接続の面倒をみる層。
 * 再接続と資格情報の保存を引き受け、受け取ったメッセージはそのまま呼び出し側へ渡す。
 */

import type { ClientMessage, ServerMessage } from './protocol'
import { FATAL_ERROR_CODES } from './protocol'

const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 8000]

export interface Credentials {
  player_id: string
  token: string
  name: string
}

export interface ConnectionHandlers {
  onMessage(message: ServerMessage): void
  onStatus(status: ConnectionStatus): void
}

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

function credentialKey(roomCode: string): string {
  return `katakananuki:room:${roomCode}`
}

export function loadCredentials(roomCode: string): Credentials | null {
  try {
    const raw = localStorage.getItem(credentialKey(roomCode))
    return raw ? (JSON.parse(raw) as Credentials) : null
  } catch {
    // 閲覧モードなどで localStorage を触れないことがある。新規参加として続ける
    return null
  }
}

export function saveCredentials(roomCode: string, credentials: Credentials): void {
  try {
    localStorage.setItem(credentialKey(roomCode), JSON.stringify(credentials))
  } catch {
    // 保存できなくても遊べる。リロードで別人になるだけ
  }
}

export function clearCredentials(roomCode: string): void {
  try {
    localStorage.removeItem(credentialKey(roomCode))
  } catch {
    // 消せなくても実害はない
  }
}

export class GameConnection {
  private socket: WebSocket | null = null
  private attempt = 0
  private timer: number | null = null
  private givenUp = false

  constructor(
    private readonly roomCode: string,
    private readonly name: string,
    private readonly handlers: ConnectionHandlers,
  ) {}

  open(): void {
    this.givenUp = false
    this.dial()
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  close(): void {
    this.givenUp = true
    if (this.timer !== null) window.clearTimeout(this.timer)
    this.socket?.close()
    this.socket = null
    this.handlers.onStatus('closed')
  }

  private dial(): void {
    this.handlers.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')

    const saved = loadCredentials(this.roomCode)
    const params = new URLSearchParams({ name: saved?.name ?? this.name })
    if (saved) {
      params.set('player_id', saved.player_id)
      params.set('token', saved.token)
    }

    const scheme = location.protocol === 'https:' ? 'wss' : 'ws'
    const socket = new WebSocket(`${scheme}://${location.host}/ws/${this.roomCode}?${params}`)
    this.socket = socket

    socket.onopen = () => {
      this.attempt = 0
      this.handlers.onStatus('open')
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as ServerMessage

      if (message.type === 'joined') {
        saveCredentials(this.roomCode, {
          player_id: message.player_id,
          token: message.token,
          name: loadCredentials(this.roomCode)?.name ?? this.name,
        })
      }

      if (message.type === 'error' && FATAL_ERROR_CODES.has(message.code)) {
        // 断られた資格情報を持ち続けると、入り直しても同じ理由で弾かれる
        if (message.code === 'bad_token') clearCredentials(this.roomCode)
        this.givenUp = true
      }

      this.handlers.onMessage(message)
    }

    socket.onclose = () => {
      if (this.givenUp) {
        this.handlers.onStatus('closed')
        return
      }
      const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)]
      this.attempt += 1
      this.handlers.onStatus('reconnecting')
      this.timer = window.setTimeout(() => this.dial(), delay)
    }
  }
}
