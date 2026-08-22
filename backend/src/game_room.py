"""ルーム 1 つ分の Durable Object。

状態・締切タイマー・全員の WebSocket 接続をこのオブジェクトがまとめて持つ。
単一スレッドで直列に実行されるため、正解タップと締切の発火が競合しても
二重に処理されることがない。排他制御は書かない。
"""

import json
from random import Random
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import game
from game import GameError
from js import Date, WebSocketPair
from models import Room
from pyodide.ffi import to_js
from words import all_words, pick_word
from workers import DurableObject, Response

# 参加を断るときの close コード (RFC 6455 の policy violation)
WS_CLOSE_POLICY_VIOLATION = 1008

STORAGE_KEY_ROOM = "room"
STORAGE_KEY_TOKENS = "tokens"


class GameRoom(DurableObject):
    def __init__(self, ctx, env):
        super().__init__(ctx, env)
        self.ctx = ctx
        self.env = env
        self._room: Room | None = None
        self._tokens: dict[str, str] = {}
        self._loaded = False

    async def fetch(self, request):
        if (request.headers.get("Upgrade") or "").lower() != "websocket":
            return Response("この入口は WebSocket 専用です", status=400)

        url = urlparse(request.url)
        query = parse_qs(url.query)
        room_code = url.path.rsplit("/", 1)[-1]

        await self._load(room_code)
        client, server = WebSocketPair.new().object_values()

        credentials = self._authenticate(query)
        if credentials is None:
            return _reject(client, server, "bad_token", "認証に失敗しました。参加し直してください")

        player_id, token, is_new = credentials
        try:
            game.join(self._room, player_id, _query_value(query, "name"))
        except GameError as e:
            return _reject(client, server, e.code, e.message)

        if is_new:
            self._tokens[player_id] = token
        if not self._room.host_id:
            self._room.host_id = player_id

        # タグにプレイヤー id を載せる。休止から復帰したときに
        # どの接続が誰なのかを思い出せる手立てがこれしかない
        self.ctx.acceptWebSocket(server, to_js([player_id]))
        server.send(
            json.dumps(
                {
                    "type": "joined",
                    "player_id": player_id,
                    "token": token,
                    "server_time_ms": int(Date.now()),
                }
            )
        )
        await self._persist()
        self._broadcast_state()
        return Response(None, status=101, web_socket=client)

    async def webSocketMessage(self, ws, message):
        await self._load()
        player_id = self._player_id_of(ws)
        try:
            self._dispatch(player_id, json.loads(message))
        except GameError as e:
            ws.send(_error_message(e.code, e.message))
            return
        except (ValueError, KeyError, TypeError) as e:
            ws.send(_error_message("bad_request", f"要求を解釈できません: {e}"))
            return

        await self._persist()
        await self._sync_alarm()
        self._broadcast_state()

    async def webSocketClose(self, ws, code, reason, was_clean):
        await self._load()
        game.set_connected(self._room, self._player_id_of(ws), False)
        await self._persist()
        self._broadcast_state()

    async def webSocketError(self, ws, error):
        await self._load()
        game.set_connected(self._room, self._player_id_of(ws), False)
        await self._persist()

    async def alarm(self):
        """ラウンドの締切。時間切れの確定はここだけが行う。"""
        await self._load()
        if self._room is None:
            return
        if game.handle_timeup(self._room, int(Date.now())):
            await self._persist()
            self._broadcast_state()

    def _dispatch(self, player_id: str, data: dict) -> None:
        room = self._room
        action = data.get("type")

        if action == "update_settings":
            game.update_settings(
                room, player_id, data.get("time_limit_sec"), data.get("total_laps")
            )
        elif action == "start_game":
            game.start_game(room, player_id)
        elif action == "start_round":
            word = pick_word(all_words(), room.used_word_ids, Random())
            game.start_round(room, player_id, word, int(Date.now()))
        elif action == "answer_correct":
            game.answer_correct(room, player_id, data.get("answerer_id", ""))
        elif action == "pass_round":
            game.pass_round(room, player_id)
        elif action == "next_round":
            game.next_round(room, player_id)
        elif action == "restart_game":
            game.restart_game(room, player_id)
        else:
            raise GameError("unknown_action", f"知らない操作です: {action}")

    def _authenticate(self, query: dict) -> tuple[str, str, bool] | None:
        """(player_id, token, 新規かどうか) を返す。照合に失敗したら None。

        player_id は全員の画面に配られるので、それだけでは本人確認にならない。
        マスターにしか送らないお題を他人の id で覗かれないよう token を併用する。
        """
        player_id = _query_value(query, "player_id")
        token = _query_value(query, "token")

        if not player_id or not token:
            return str(uuid4()), str(uuid4()), True
        if self._tokens.get(player_id) != token:
            return None
        return player_id, token, False

    def _state_message(self, player_id: str) -> str:
        """接続ごとに中身を変える。マスター以外にはお題を載せない。"""
        room = self._room.model_dump()
        if player_id != self._room.master_id:
            room["current_word"] = None
        return json.dumps({"type": "state", "room": room})

    def _broadcast_state(self) -> None:
        if self._room is None:
            return
        for ws in self.ctx.getWebSockets():
            try:
                ws.send(self._state_message(self._player_id_of(ws)))
            except Exception as e:
                print(f"送信できない接続を飛ばしました: {e}")

    def _player_id_of(self, ws) -> str:
        tags = list(self.ctx.getTags(ws))
        return tags[0] if tags else ""

    async def _load(self, room_code: str = "") -> None:
        if self._loaded:
            return
        stored_room = await self.ctx.storage.get(STORAGE_KEY_ROOM)
        stored_tokens = await self.ctx.storage.get(STORAGE_KEY_TOKENS)

        if stored_room:
            self._room = Room.model_validate_json(stored_room)
        else:
            self._room = game.create_room(room_code, host_id="")
        self._tokens = json.loads(stored_tokens) if stored_tokens else {}
        self._loaded = True

    async def _persist(self) -> None:
        await self.ctx.storage.put(STORAGE_KEY_ROOM, self._room.model_dump_json())
        await self.ctx.storage.put(STORAGE_KEY_TOKENS, json.dumps(self._tokens))

    async def _sync_alarm(self) -> None:
        if self._room.deadline_ms is None:
            await self.ctx.storage.deleteAlarm()
        else:
            await self.ctx.storage.setAlarm(self._room.deadline_ms)


def _query_value(query: dict, key: str) -> str:
    values = query.get(key)
    return values[0] if values else ""


def _error_message(code: str, message: str) -> str:
    return json.dumps({"type": "error", "code": code, "message": message})


def _reject(client, server, code: str, message: str):
    """参加を断って接続を閉じる。

    Hibernation 用の acceptWebSocket で受けたものは Durable Object の管理下に
    入ってしまい、その場で閉じても居座る。断る接続はこちらで直接扱う。
    """
    server.accept()
    server.send(_error_message(code, message))
    server.close(WS_CLOSE_POLICY_VIOLATION, code)
    return Response(None, status=101, web_socket=client)
