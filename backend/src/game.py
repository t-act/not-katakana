"""ゲームのルールそのもの。

I/O を一切持たず、現在時刻も乱数も引数で受け取る。Workers ランタイムを
起動せずに普通の pytest でルールを検証できるようにするための分離であり、
WebSocket 送信・Alarm・storage の操作は呼び出し側 (game_room.py) が行う。
"""

from models import (
    ALLOWED_TIME_LIMIT_SEC,
    MAX_LAPS,
    MAX_PLAYERS,
    MIN_LAPS,
    MIN_PLAYERS,
    NAME_MAX_LENGTH,
    Player,
    Room,
    RoomSettings,
    RoundOutcome,
    RoundResult,
    Word,
)

MS_PER_SEC = 1000


class GameError(Exception):
    """ルール上できない操作。呼び出し側が error メッセージに変換する。"""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def create_room(code: str, host_id: str) -> Room:
    return Room(code=code, host_id=host_id)


def join(room: Room, player_id: str, name: str) -> Player:
    """参加または再接続する。

    既知の player_id なら phase を問わず再接続として扱う。ゲーム中の
    リロードや電波断からの復帰を新規参加と区別するのがこの分岐の役割。
    """
    existing = room.find_player(player_id)
    if existing is not None:
        existing.connected = True
        return existing

    if room.phase != "lobby":
        raise GameError("game_started", "もう始まっています")
    if len(room.players) >= MAX_PLAYERS:
        raise GameError("room_full", f"このへやは {MAX_PLAYERS} 人までです")

    normalized_name = name.strip()
    if not normalized_name or len(normalized_name) > NAME_MAX_LENGTH:
        raise GameError("invalid_name", f"名前は 1〜{NAME_MAX_LENGTH} 文字にしてください")

    player = Player(id=player_id, name=normalized_name, order=len(room.players))
    room.players.append(player)
    return player


def set_connected(room: Room, player_id: str, connected: bool) -> None:
    """接続状態だけを更新する。切断してもプレイヤーは一覧から外さない。

    途中退出で players を縮めると総ラウンド数とマスターの担当回数が
    変わってしまうため、離脱者は connected=False のまま席に残す。
    """
    player = room.find_player(player_id)
    if player is not None:
        player.connected = connected


def update_settings(
    room: Room,
    actor_id: str,
    time_limit_sec: int | None = None,
    total_laps: int | None = None,
) -> None:
    _require_host(room, actor_id)
    _require_phase(room, "lobby")

    if time_limit_sec is not None and time_limit_sec not in ALLOWED_TIME_LIMIT_SEC:
        raise GameError(
            "invalid_settings", f"持ち時間は {ALLOWED_TIME_LIMIT_SEC} から選んでください"
        )
    if total_laps is not None and not MIN_LAPS <= total_laps <= MAX_LAPS:
        raise GameError("invalid_settings", f"まわす回数は {MIN_LAPS}〜{MAX_LAPS} 周までです")

    room.settings = RoomSettings(
        time_limit_sec=time_limit_sec or room.settings.time_limit_sec,
        total_laps=total_laps or room.settings.total_laps,
    )


def start_game(room: Room, actor_id: str) -> None:
    _require_host(room, actor_id)
    _require_phase(room, "lobby")
    if len(room.players) < MIN_PLAYERS:
        raise GameError("not_enough_players", f"はじめるには {MIN_PLAYERS} 人からです")

    _reset_progress(room)
    room.phase = "round_ready"


def start_round(room: Room, actor_id: str, word: Word, now_ms: int) -> None:
    """マスターがお題を開き、締切を確定させる。

    word の抽選を呼び出し側に任せているのは、乱数をこの層に持ち込まず
    テストで出題を固定できるようにするため。
    """
    _require_phase(room, "round_ready")
    _require_master(room, actor_id)

    if word.id in room.used_word_ids:
        # 同じ語が返ってきたのは全語を使い切った合図なので、履歴を畳んで数え直す
        room.used_word_ids.clear()
    room.used_word_ids.append(word.id)

    room.current_word = word
    room.deadline_ms = now_ms + room.settings.time_limit_sec * MS_PER_SEC
    room.phase = "round_active"


def answer_correct(room: Room, actor_id: str, answerer_id: str) -> None:
    """マスターが正解者を確定する。得点は正解者だけに入る。"""
    _require_phase(room, "round_active")
    _require_master(room, actor_id)

    answerer = room.find_player(answerer_id)
    if answerer is None:
        raise GameError("unknown_player", "その人が見つかりません")
    if answerer.id == room.master_id:
        raise GameError("self_answer", "説明役は自分を選べません")

    answerer.score += 1
    _finish_round(room, "correct", answerer_id=answerer.id)


def pass_round(room: Room, actor_id: str) -> None:
    """マスターが降参する。カタカナ語を指摘された場合もここを通る。"""
    _require_phase(room, "round_active")
    _require_master(room, actor_id)
    _finish_round(room, "passed")


def handle_timeup(room: Room, now_ms: int) -> bool:
    """締切に到達したラウンドを時間切れで終える。終了させたら True。

    now_ms が締切前なら何もしない。Alarm の早発火やクライアント由来の
    催促を受けても、締切を過ぎるまでは決してラウンドを閉じないため。
    """
    if room.phase != "round_active" or room.deadline_ms is None:
        return False
    if now_ms < room.deadline_ms:
        return False

    _finish_round(room, "timeup")
    return True


def next_round(room: Room, actor_id: str) -> None:
    """結果画面から次のラウンドの待機へ進む。

    実行できるのは次に説明する人だけ。全員が結果を読み終える前に
    先へ進んでしまうのを防ぐ。
    """
    _require_phase(room, "round_result")
    _require_master(room, actor_id)

    room.last_result = None
    room.phase = "round_ready"


def restart_game(room: Room, actor_id: str) -> None:
    """同じ顔ぶれでもう一度遊ぶ。

    used_word_ids は引き継ぐ。同じ集まりの中で直前に出た語が
    すぐ再登場すると興ざめするため。
    """
    _require_host(room, actor_id)
    _require_phase(room, "finished")

    _reset_progress(room)
    room.phase = "round_ready"


def winners(room: Room) -> list[Player]:
    """最高得点のプレイヤー全員。同点なら複数人を返す。"""
    if not room.players:
        return []
    top_score = max(p.score for p in room.players)
    return [p for p in room.players if p.score == top_score]


def _finish_round(room: Room, outcome: RoundOutcome, answerer_id: str | None = None) -> None:
    assert room.current_word is not None, "round_active なら必ずお題がある"

    # rounds_played を進めると master_id が次の人に変わるため、先に記録する
    room.last_result = RoundResult(
        outcome=outcome,
        word=room.current_word,
        master_id=room.players[room.master_index].id,
        answerer_id=answerer_id,
    )
    room.current_word = None
    room.deadline_ms = None
    room.rounds_played += 1
    room.phase = "finished" if room.rounds_played >= room.total_rounds else "round_result"


def _reset_progress(room: Room) -> None:
    for player in room.players:
        player.score = 0
    room.rounds_played = 0
    room.current_word = None
    room.deadline_ms = None
    room.last_result = None


def _require_host(room: Room, actor_id: str) -> None:
    if actor_id != room.host_id:
        raise GameError("not_host", "まとめ役だけが進められます")


def _require_master(room: Room, actor_id: str) -> None:
    """マスター本人か、マスターが不在なら誰でも通す。

    マスターの端末が落ちたまま戻らないと進行が止まってしまう。切断を検知して
    タイマーで代役を立てるより、居ない間は誰でも代われる方が対面では素直に動く。
    """
    master = room.players[room.master_index]
    if actor_id == master.id or not master.connected:
        return
    raise GameError("not_master", "説明役だけが進められます")


def _require_phase(room: Room, expected: str) -> None:
    if room.phase != expected:
        # phase は内部の名前なので player には出さない
        raise GameError("wrong_phase", "いまはその操作はできません")
