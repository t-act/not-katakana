"""検証用の相手役。自分の番が来たら自動で進める。

ブラウザ側の操作を待たずに場が止まらないよう、マスターになったら
少し置いてからお題を開き、しばらくして誰かを正解にする。
"""

import asyncio
import json
import random
import sys
import urllib.parse

import websockets

ROOM_CODE = sys.argv[1]
NAME = sys.argv[2]
# 第 3 引数に周回数を渡すと、ホストになったとき自分でゲームを始める
AUTO_START_LAPS = int(sys.argv[3]) if len(sys.argv) > 3 else 0
MIN_PLAYERS = 3
THINK_SEC = 3.0
EXPLAIN_SEC = 7.0


async def main() -> None:
    params = urllib.parse.urlencode({"name": NAME})
    url = f"ws://127.0.0.1:8787/ws/{ROOM_CODE}?{params}"
    async with websockets.connect(url) as ws:
        me = None
        started = False
        async for raw in ws:
            msg = json.loads(raw)
            if msg["type"] == "joined":
                me = msg["player_id"]
                print(f"{NAME} 参加", flush=True)
                continue
            if msg["type"] != "state":
                print(f"{NAME} <- {msg}", flush=True)
                continue

            room = msg["room"]

            if (
                AUTO_START_LAPS
                and not started
                and room["phase"] == "lobby"
                and room["host_id"] == me
                and len(room["players"]) >= MIN_PLAYERS
            ):
                await asyncio.sleep(THINK_SEC)
                await ws.send(
                    json.dumps(
                        {
                            "type": "update_settings",
                            "total_laps": AUTO_START_LAPS,
                        }
                    )
                )
                await ws.send(json.dumps({"type": "start_game"}))
                started = True
                continue

            if room["master_id"] != me:
                continue

            if room["phase"] == "round_ready":
                await asyncio.sleep(THINK_SEC)
                await ws.send(json.dumps({"type": "start_round"}))
            elif room["phase"] == "round_active":
                await asyncio.sleep(EXPLAIN_SEC)
                others = [p for p in room["players"] if p["id"] != me]
                await ws.send(
                    json.dumps(
                        {
                            "type": "answer_correct",
                            "answerer_id": random.choice(others)["id"],
                        }
                    )
                )
            elif room["phase"] == "round_result":
                await asyncio.sleep(THINK_SEC)
                await ws.send(json.dumps({"type": "next_round"}))


asyncio.run(main())
