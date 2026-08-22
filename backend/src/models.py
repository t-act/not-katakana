"""ゲームの状態を表すデータモデル。

フロントエンドの ws/protocol.ts と 1:1 で対応させる。
"""

from typing import Literal

from pydantic import BaseModel, Field, computed_field

MIN_PLAYERS = 3
MAX_PLAYERS = 6
NAME_MAX_LENGTH = 12
ALLOWED_TIME_LIMIT_SEC = (30, 60, 90, 120)
MIN_LAPS = 1
MAX_LAPS = 5

Phase = Literal["lobby", "round_ready", "round_active", "round_result", "finished"]
RoundOutcome = Literal["correct", "timeup", "passed"]
Difficulty = Literal["easy", "normal", "hard"]


class Word(BaseModel):
    """お題となるカタカナ語。"""

    id: str
    word: str
    difficulty: Difficulty = "normal"
    tags: list[str] = Field(default_factory=list)


class Player(BaseModel):
    id: str
    name: str
    score: int = 0
    order: int
    connected: bool = True


class RoomSettings(BaseModel):
    time_limit_sec: int = 60
    total_laps: int = 2


class RoundResult(BaseModel):
    """直前のラウンドの顛末。

    word を含めるのは意図的で、ラウンドが終わればお題は全員に明かしてよい。
    秘匿が必要なのは進行中の current_word だけ。
    """

    outcome: RoundOutcome
    word: Word
    master_id: str
    answerer_id: str | None = None


class Room(BaseModel):
    """1 ルームの全状態。

    進行状況は rounds_played 1 つだけを持ち、マスターが誰か・何周目かは
    そこから導出する。master_index と current_lap を別々に保持すると
    3 つの値が食い違う状態を作れてしまうため、単一の情報源に寄せている。
    """

    code: str
    host_id: str
    settings: RoomSettings = Field(default_factory=RoomSettings)
    players: list[Player] = Field(default_factory=list)
    phase: Phase = "lobby"
    rounds_played: int = 0
    current_word: Word | None = None
    deadline_ms: int | None = None
    used_word_ids: list[str] = Field(default_factory=list)
    last_result: RoundResult | None = None

    @computed_field
    @property
    def master_index(self) -> int:
        if not self.players:
            return 0
        return self.rounds_played % len(self.players)

    @computed_field
    @property
    def current_lap(self) -> int:
        if not self.players:
            return 1
        return self.rounds_played // len(self.players) + 1

    @computed_field
    @property
    def total_rounds(self) -> int:
        return len(self.players) * self.settings.total_laps

    @computed_field
    @property
    def master_id(self) -> str | None:
        if not self.players:
            return None
        return self.players[self.master_index].id

    def find_player(self, player_id: str) -> Player | None:
        return next((p for p in self.players if p.id == player_id), None)
