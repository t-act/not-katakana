"""Worker の入口。

WebSocket はルームごとの Durable Object へ、HTTP API は FastAPI へ、
それ以外はフロントの静的アセットへ振り分ける。フロントと API を同じ
オリジンに載せているので、CORS の設定も接続先の切り替えも要らない。
"""

from urllib.parse import urlparse

from api import app
from game_room import GameRoom
from workers import Response, WorkerEntrypoint

WS_PREFIX = "/ws/"
API_PREFIX = "/api/"

# wrangler が Durable Object クラスを見つけられるよう入口から公開する
__all__ = ["Default", "GameRoom"]


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        path = urlparse(request.url).path

        if path.startswith(WS_PREFIX):
            room_code = path[len(WS_PREFIX) :]
            if not room_code:
                return Response("合いことばがありません", status=400)
            room_id = self.env.GAME_ROOM.idFromName(room_code)
            return await self.env.GAME_ROOM.get(room_id).fetch(request)

        if path.startswith(API_PREFIX):
            import asgi

            return await asgi.fetch(app, request.js_object, self.env)

        return await self.env.ASSETS.fetch(request)
