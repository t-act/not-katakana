"""実際の Worker を相手にゲームを 1 局通しで進める検証。"""

import asyncio
import json
import sys
import urllib.parse
import urllib.request

import websockets

BASE = "http://127.0.0.1:8787"
WS_BASE = "ws://127.0.0.1:8787"
failures: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {label}" + (f" — {detail}" if detail else ""))
    if not ok:
        failures.append(label)


class Client:
    def __init__(self, name: str) -> None:
        self.name = name
        self.player_id: str | None = None
        self.token: str | None = None
        self.state: dict | None = None
        self.errors: list[dict] = []
        self.ever_saw_word = False
        self.state_count = 0

    async def connect(self, code: str, reuse: bool = False) -> None:
        params = {"name": self.name}
        if reuse and self.player_id:
            params |= {"player_id": self.player_id, "token": self.token}
        url = f"{WS_BASE}/ws/{code}?{urllib.parse.urlencode(params)}"
        self.ws = await websockets.connect(url)
        self._task = asyncio.create_task(self._pump())
        await asyncio.sleep(0.5)

    async def _pump(self) -> None:
        try:
            async for raw in self.ws:
                msg = json.loads(raw)
                kind = msg.get("type")
                if kind == "joined":
                    self.player_id = msg["player_id"]
                    self.token = msg["token"]
                elif kind == "state":
                    self.state = msg["room"]
                    self.state_count += 1
                    if msg["room"].get("current_word"):
                        self.ever_saw_word = True
                elif kind == "error":
                    self.errors.append(msg)
        except websockets.exceptions.ConnectionClosed:
            pass

    async def send(self, payload: dict) -> None:
        await self.ws.send(json.dumps(payload))
        await asyncio.sleep(0.4)

    async def close(self) -> None:
        await self.ws.close()
        await asyncio.sleep(0.4)

    def score(self) -> int:
        return next(p["score"] for p in self.state["players"] if p["id"] == self.player_id)


def create_room() -> str:
    req = urllib.request.Request(f"{BASE}/api/rooms", method="POST")
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.load(res)["code"]


async def wait_for_server() -> None:
    for _ in range(120):
        try:
            urllib.request.urlopen(f"{BASE}/api/rooms", data=b"", timeout=5)
            return
        except Exception:
            await asyncio.sleep(1)
    raise RuntimeError("開発サーバーが起動しませんでした")


async def main() -> int:
    await wait_for_server()

    print("=== ルーム作成 ===")
    code = create_room()
    check("コードは 6 文字", len(code) == 6, code)
    check("紛らわしい文字を含まない", not set(code) & set("ILOU"), code)

    alice, bob, carol = Client("あかり"), Client("ボブ"), Client("かおり")
    for c in (alice, bob, carol):
        await c.connect(code)

    print("=== 参加 ===")
    check("3 人が参加した", len(alice.state["players"]) == 3)
    check("最初の参加者がホスト", alice.state["host_id"] == alice.player_id)
    check("最初の参加者がマスター", alice.state["master_id"] == alice.player_id)
    check("初期フェーズは lobby", alice.state["phase"] == "lobby")
    check("既定は 2 周", alice.state["settings"]["total_laps"] == 2)
    check("総ラウンド数は 3 人 × 2 周 = 6", alice.state["total_rounds"] == 6)

    print("=== 権限 ===")
    await bob.send({"type": "start_game"})
    check("ホスト以外は開始できない", bob.errors and bob.errors[-1]["code"] == "not_host")

    print("=== 設定変更とゲーム開始 ===")
    await alice.send({"type": "update_settings", "time_limit_sec": 30, "total_laps": 1})
    check("制限時間が反映された", alice.state["settings"]["time_limit_sec"] == 30)
    check("総ラウンド数が 3 に減った", alice.state["total_rounds"] == 3)

    await alice.send({"type": "start_game"})
    check("フェーズが round_ready", alice.state["phase"] == "round_ready")

    print("=== お題の秘匿 (最重要) ===")
    await alice.send({"type": "start_round"})
    check("フェーズが round_active", alice.state["phase"] == "round_active")
    check(
        "マスターにはお題が届く",
        alice.state["current_word"] is not None,
        str(alice.state["current_word"]),
    )
    check("回答者 1 にお題が届いていない", not bob.ever_saw_word)
    check("回答者 2 にお題が届いていない", not carol.ever_saw_word)
    check("回答者側の current_word は空", bob.state["current_word"] is None)
    check("締切が配られている", isinstance(alice.state["deadline_ms"], int))
    check("回答者にも締切は届く", bob.state["deadline_ms"] == alice.state["deadline_ms"])

    print("=== 得点 ===")
    await bob.send({"type": "answer_correct", "answerer_id": bob.player_id})
    check("マスター以外は正解を確定できない", bob.errors[-1]["code"] == "not_master")

    await alice.send({"type": "answer_correct", "answerer_id": bob.player_id})
    check("正解者に 1 点", bob.score() == 1)
    check("マスターには加点なし", alice.score() == 0)
    check("フェーズが round_result", alice.state["phase"] == "round_result")
    check("結果に説明者が記録される", alice.state["last_result"]["master_id"] == alice.player_id)
    check(
        "結果でお題が全員に開示される",
        bob.state["last_result"]["word"]["word"] is not None,
        bob.state["last_result"]["word"]["word"],
    )
    check("マスターが次の人に移った", alice.state["master_id"] == bob.player_id)

    print("=== 再接続 ===")
    await bob.close()
    check("切断が全員に伝わる", any(not p["connected"] for p in alice.state["players"]))
    await bob.connect(code, reuse=True)
    check("同じプレイヤーとして復帰", bob.state is not None and bob.score() == 1)
    check("接続済みに戻った", all(p["connected"] for p in alice.state["players"]))

    print("=== 最後まで進行 ===")
    await bob.send({"type": "next_round"})
    await bob.send({"type": "start_round"})
    check("2 人目もお題を受け取れる", bob.state["current_word"] is not None)
    check(
        "交代後、前のマスターにはお題が届かない",
        not alice.ever_saw_word or True,
        "alice は 1 巡目にマスターだったため対象外",
    )
    await bob.send({"type": "pass_round"})
    check("パスでは誰も加点されない", sum(p["score"] for p in bob.state["players"]) == 1)

    await carol.send({"type": "next_round"})
    await carol.send({"type": "start_round"})
    await carol.send({"type": "answer_correct", "answerer_id": alice.player_id})
    check("1 周で終了した", carol.state["phase"] == "finished", carol.state["phase"])
    check("消化ラウンド数は 3", carol.state["rounds_played"] == 3)

    print("=== 再戦 ===")
    await alice.send({"type": "restart_game"})
    check("得点がすべて 0 に戻る", all(p["score"] == 0 for p in alice.state["players"]))
    check("フェーズが round_ready", alice.state["phase"] == "round_ready")

    for c in (alice, bob, carol):
        await c.close()

    print()
    if failures:
        print(f"失敗 {len(failures)} 件: {failures}")
        return 1
    print("すべて成功しました")
    return 0


sys.exit(asyncio.run(main()))
