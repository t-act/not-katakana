"""締切タイマーと認証の検証。制限時間 30 秒を実際に待つ。"""

import asyncio
import json
import sys
import time
import urllib.parse
import urllib.request

import websockets

WS_BASE = "ws://127.0.0.1:8787"
failures = []


def check(label, ok, detail=""):
    print(f"  [{'PASS' if ok else 'FAIL'}] {label}" + (f" — {detail}" if detail else ""))
    if not ok:
        failures.append(label)


def create_room():
    req = urllib.request.Request("http://127.0.0.1:8787/api/rooms", method="POST")
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.load(res)["code"]


class Client:
    def __init__(self, name):
        self.name, self.state, self.errors = name, None, []
        self.player_id = self.token = None
        self.closed_code = None

    async def connect(self, code, **extra):
        params = {"name": self.name} | extra
        self.ws = await websockets.connect(f"{WS_BASE}/ws/{code}?{urllib.parse.urlencode(params)}")
        # 参照を持たないとタスクが回収されて切断を取りこぼす
        self._task = asyncio.create_task(self._pump())
        await asyncio.sleep(0.5)

    async def _pump(self):
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                if msg["type"] == "joined":
                    self.player_id, self.token = msg["player_id"], msg["token"]
                elif msg["type"] == "state":
                    self.state = msg["room"]
                elif msg["type"] == "error":
                    self.errors.append(msg)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            # 正常な close は async for を例外なしで抜けるため、
            # ConnectionClosed だけを見ていると取りこぼす
            self.closed_code = self.ws.close_code

    async def send(self, payload):
        await self.ws.send(json.dumps(payload))
        await asyncio.sleep(0.4)


async def main():
    code = create_room()
    a, b, c = Client("あかり"), Client("ボブ"), Client("かおり")
    for cl in (a, b, c):
        await cl.connect(code)

    print("=== 不正な認証 ===")
    intruder = Client("なりすまし")
    await intruder.connect(code, player_id=a.player_id, token="でたらめな値")
    # 切断は往復ぶん遅れて届く。届くまで待ってから判定する
    for _ in range(25):
        if intruder.closed_code is not None:
            break
        await asyncio.sleep(0.2)
    check(
        "他人の id では入れない",
        any(e["code"] == "bad_token" for e in intruder.errors),
        str(intruder.errors),
    )
    check("接続が閉じられる", intruder.closed_code == 1008, str(intruder.closed_code))
    check("参加者は 3 人のまま", len(a.state["players"]) == 3)

    print("=== 締切タイマー (30 秒待ちます) ===")
    await a.send({"type": "update_settings", "time_limit_sec": 30})
    await a.send({"type": "start_game"})
    await a.send({"type": "start_round"})

    deadline = a.state["deadline_ms"]
    started = time.time()
    check("締切は約 30 秒後", 29 <= (deadline - int(time.time() * 1000)) / 1000 <= 31)

    for _ in range(45):
        await asyncio.sleep(1)
        if a.state["phase"] != "round_active":
            break
    elapsed = time.time() - started

    check("時間切れでラウンドが閉じた", a.state["phase"] == "round_result", a.state["phase"])
    check("結果は timeup", a.state["last_result"]["outcome"] == "timeup")
    check("誰も加点されていない", all(p["score"] == 0 for p in a.state["players"]))
    check("お題が伏せられたまま持ち越されない", a.state["current_word"] is None)
    both_moved = b.state["phase"] == "round_result" and c.state["phase"] == "round_result"
    check("全員が同時に結果へ遷移", both_moved)
    check("経過はおよそ 30 秒", 29 <= elapsed <= 34, f"{elapsed:.1f} 秒")

    print("=== 締切後の遅れた操作 ===")
    await a.send({"type": "answer_correct", "answerer_id": b.player_id})
    check(
        "時間切れ後の正解タップは弾かれる",
        a.errors and a.errors[-1]["code"] == "wrong_phase",
        str(a.errors[-1:]),
    )
    check("加点されていない", all(p["score"] == 0 for p in a.state["players"]))

    print()
    if failures:
        print(f"失敗 {len(failures)} 件: {failures}")
        return 1
    print("すべて成功しました")
    return 0


sys.exit(asyncio.run(main()))
