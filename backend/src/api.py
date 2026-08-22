"""HTTP API。

ルームコードの発行だけを担当する。ルーム本体の状態は Durable Object が持ち、
最初の WebSocket 接続を受けた時点で実体が生まれる。
"""

from random import Random

from fastapi import FastAPI
from pydantic import BaseModel

# Crockford Base32。口頭とメモで伝わるよう I / L / O / U を除いてある
ROOM_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
ROOM_CODE_LENGTH = 6

app = FastAPI(docs_url=None, redoc_url=None)


class CreateRoomResponse(BaseModel):
    code: str


@app.post("/api/rooms")
async def create_room() -> CreateRoomResponse:
    """新しいルームコードを発行する。

    既存コードとの重複は確認していない。32^6 = 約 10 億通りに対して
    同時に生きているルームは多くても数個で、衝突を気にする水準にない。
    """
    rng = Random()
    code = "".join(rng.choice(ROOM_CODE_ALPHABET) for _ in range(ROOM_CODE_LENGTH))
    return CreateRoomResponse(code=code)
