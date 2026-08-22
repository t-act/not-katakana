"""ゲームルールの検証。

「アプリ実装版の仕様表」に書かれた各項目が守られていることを確かめる。
"""

import game
import pytest
from game import GameError
from models import MAX_PLAYERS, MIN_PLAYERS, Room, Word

HOST_ID = "p0"
TIME_LIMIT_SEC = 60


def make_room(player_count: int = 3) -> Room:
    room = game.create_room("ABC123", HOST_ID)
    for i in range(player_count):
        game.join(room, f"p{i}", f"プレイヤー{i}")
    return room


def make_word(index: int) -> Word:
    return Word(id=f"w{index:03d}", word=f"お題{index}")


def started_room(player_count: int = 3) -> Room:
    room = make_room(player_count)
    game.start_game(room, HOST_ID)
    return room


def play_round(room: Room, outcome: str = "correct", now_ms: int = 0) -> str:
    """1 ラウンドを最後まで進め、正解者の id を返す (正解以外は空文字)。"""
    master = room.players[room.master_index]
    game.start_round(room, master.id, make_word(room.rounds_played), now_ms)

    if outcome == "correct":
        answerer = room.players[(room.master_index + 1) % len(room.players)]
        game.answer_correct(room, master.id, answerer.id)
        return answerer.id
    if outcome == "passed":
        game.pass_round(room, master.id)
    else:
        game.handle_timeup(room, now_ms + TIME_LIMIT_SEC * 1000)
    return ""


def advance(room: Room) -> None:
    """結果画面から次のラウンド待機へ進める。"""
    game.next_round(room, room.players[room.master_index].id)


class TestJoin:
    def test_assigns_sequential_order(self):
        room = make_room(3)
        assert [p.order for p in room.players] == [0, 1, 2]

    def test_accepts_up_to_max_players(self):
        room = make_room(MAX_PLAYERS)
        assert len(room.players) == MAX_PLAYERS

    def test_rejects_player_beyond_max(self):
        room = make_room(MAX_PLAYERS)
        with pytest.raises(GameError) as excinfo:
            game.join(room, "extra", "はみだし")
        assert excinfo.value.code == "room_full"

    def test_rejects_new_player_after_game_started(self):
        room = started_room()
        with pytest.raises(GameError) as excinfo:
            game.join(room, "latecomer", "遅刻")
        assert excinfo.value.code == "game_started"

    def test_allows_rejoin_after_game_started(self):
        room = started_room()
        game.set_connected(room, "p1", False)

        rejoined = game.join(room, "p1", "プレイヤー1")

        assert rejoined.connected is True
        assert len(room.players) == 3

    def test_rejoin_keeps_score(self):
        room = started_room()
        play_round(room)  # p1 が 1 点を得る

        rejoined = game.join(room, "p1", "別名を送っても")

        assert rejoined.score == 1
        assert rejoined.name == "プレイヤー1"

    @pytest.mark.parametrize("name", ["", "   ", "あ" * 13])
    def test_rejects_invalid_name(self, name):
        room = game.create_room("ABC123", HOST_ID)
        with pytest.raises(GameError) as excinfo:
            game.join(room, "p0", name)
        assert excinfo.value.code == "invalid_name"

    def test_trims_surrounding_spaces(self):
        room = game.create_room("ABC123", HOST_ID)
        player = game.join(room, "p0", "  たくと  ")
        assert player.name == "たくと"


class TestStartGame:
    def test_requires_minimum_players(self):
        room = make_room(MIN_PLAYERS - 1)
        with pytest.raises(GameError) as excinfo:
            game.start_game(room, HOST_ID)
        assert excinfo.value.code == "not_enough_players"

    def test_rejects_non_host(self):
        room = make_room(3)
        with pytest.raises(GameError) as excinfo:
            game.start_game(room, "p1")
        assert excinfo.value.code == "not_host"

    def test_moves_to_round_ready(self):
        room = started_room()
        assert room.phase == "round_ready"
        assert room.master_id == "p0"


class TestScoring:
    def test_gives_point_only_to_answerer(self):
        room = started_room()
        play_round(room, "correct")

        scores = {p.id: p.score for p in room.players}
        assert scores == {"p0": 0, "p1": 1, "p2": 0}

    def test_master_gets_no_point(self):
        room = started_room()
        master_id = room.master_id

        play_round(room, "correct")

        assert room.find_player(master_id).score == 0

    def test_pass_gives_no_point_to_anyone(self):
        room = started_room()
        play_round(room, "passed")
        assert all(p.score == 0 for p in room.players)

    def test_timeup_gives_no_point_to_anyone(self):
        room = started_room()
        play_round(room, "timeup")
        assert all(p.score == 0 for p in room.players)

    def test_rejects_master_as_answerer(self):
        room = started_room()
        master = room.players[room.master_index]
        game.start_round(room, master.id, make_word(0), 0)

        with pytest.raises(GameError) as excinfo:
            game.answer_correct(room, master.id, master.id)
        assert excinfo.value.code == "self_answer"

    def test_rejects_unknown_answerer(self):
        room = started_room()
        master = room.players[room.master_index]
        game.start_round(room, master.id, make_word(0), 0)

        with pytest.raises(GameError) as excinfo:
            game.answer_correct(room, master.id, "nobody")
        assert excinfo.value.code == "unknown_player"


class TestMasterRotation:
    def test_passes_to_next_player_in_join_order(self):
        room = started_room()
        play_round(room)
        assert room.master_id == "p1"

    def test_wraps_around_to_first_player(self):
        room = started_room()
        for _ in range(3):
            play_round(room)
            advance(room)
        assert room.master_id == "p0"
        assert room.current_lap == 2

    def test_every_player_is_master_the_same_number_of_times(self):
        room = started_room(player_count=3)
        masters = []

        while room.phase != "finished":
            masters.append(room.master_id)
            play_round(room)
            if room.phase == "round_result":
                advance(room)

        assert sorted(masters) == ["p0", "p0", "p1", "p1", "p2", "p2"]


class TestGameEnd:
    def test_finishes_after_exactly_players_times_laps_rounds(self):
        room = started_room(player_count=3)  # 3 人 × 2 周 = 6 ラウンド
        assert room.total_rounds == 6

        for _ in range(5):
            play_round(room)
            assert room.phase == "round_result", "5 ラウンド目までは終わらない"
            advance(room)

        play_round(room)
        assert room.phase == "finished"
        assert room.rounds_played == 6

    def test_does_not_require_next_round_call_to_finish(self):
        """最終ラウンドの直後は結果画面を挟まず finished に入る。"""
        room = started_room(player_count=3)
        for _ in range(5):
            play_round(room)
            advance(room)

        play_round(room)

        with pytest.raises(GameError):
            advance(room)

    @pytest.mark.parametrize("player_count, laps, expected", [(3, 1, 3), (4, 2, 8), (6, 5, 30)])
    def test_total_rounds_is_players_times_laps(self, player_count, laps, expected):
        room = make_room(player_count)
        game.update_settings(room, HOST_ID, total_laps=laps)
        assert room.total_rounds == expected

    def test_winner_is_highest_scorer(self):
        room = started_room()
        play_round(room)  # p1 に 1 点

        assert [p.id for p in game.winners(room)] == ["p1"]

    def test_all_tied_players_win(self):
        room = started_room()
        assert [p.id for p in game.winners(room)] == ["p0", "p1", "p2"]


class TestTimeup:
    def test_sets_deadline_from_time_limit(self):
        room = started_room()
        game.start_round(room, room.master_id, make_word(0), now_ms=1_000)
        assert room.deadline_ms == 1_000 + TIME_LIMIT_SEC * 1000

    def test_ignores_timeup_before_deadline(self):
        room = started_room()
        game.start_round(room, room.master_id, make_word(0), now_ms=0)

        closed = game.handle_timeup(room, now_ms=TIME_LIMIT_SEC * 1000 - 1)

        assert closed is False
        assert room.phase == "round_active"

    def test_closes_round_at_deadline(self):
        room = started_room()
        game.start_round(room, room.master_id, make_word(0), now_ms=0)

        closed = game.handle_timeup(room, now_ms=TIME_LIMIT_SEC * 1000)

        assert closed is True
        assert room.phase == "round_result"

    def test_is_idempotent_after_round_closed(self):
        """締切と正解タップが競合しても二重に処理されない。"""
        room = started_room()
        master = room.players[room.master_index]
        game.start_round(room, master.id, make_word(0), now_ms=0)
        game.answer_correct(room, master.id, "p1")

        closed = game.handle_timeup(room, now_ms=TIME_LIMIT_SEC * 1000)

        assert closed is False
        assert room.last_result.outcome == "correct"
        assert room.find_player("p1").score == 1


class TestRoundResult:
    def test_records_master_of_the_finished_round(self):
        room = started_room()
        play_round(room)

        assert room.last_result.master_id == "p0", "得点者ではなく説明者を記録する"
        assert room.master_id == "p1", "次のマスターには既に交代している"

    def test_exposes_word_after_round_ends(self):
        room = started_room()
        master = room.players[room.master_index]
        word = make_word(42)
        game.start_round(room, master.id, word, 0)
        game.pass_round(room, master.id)

        assert room.last_result.word == word
        assert room.current_word is None, "進行中のお題は伏せたまま持ち越さない"

    def test_only_next_master_can_advance(self):
        room = started_room()
        play_round(room)  # マスターは p1 に移っている

        with pytest.raises(GameError) as excinfo:
            game.next_round(room, "p2")
        assert excinfo.value.code == "not_master"


class TestWordDeck:
    def test_records_used_words(self):
        room = started_room()
        play_round(room)
        advance(room)
        play_round(room)

        assert room.used_word_ids == ["w000", "w001"]

    def test_resets_history_when_deck_is_exhausted(self):
        """全語を配り終えた合図として、既出の語が渡されたら履歴を畳む。"""
        room = started_room()
        game.start_round(room, room.master_id, make_word(0), 0)
        game.pass_round(room, room.master_id)
        advance(room)

        game.start_round(room, room.master_id, make_word(0), 0)

        assert room.used_word_ids == ["w000"]


class TestPermissions:
    def test_only_master_can_start_round(self):
        room = started_room()
        with pytest.raises(GameError) as excinfo:
            game.start_round(room, "p1", make_word(0), 0)
        assert excinfo.value.code == "not_master"

    def test_only_master_can_pass(self):
        room = started_room()
        game.start_round(room, room.master_id, make_word(0), 0)

        with pytest.raises(GameError) as excinfo:
            game.pass_round(room, "p1")
        assert excinfo.value.code == "not_master"

    def test_rejects_start_round_outside_round_ready(self):
        room = started_room()
        game.start_round(room, room.master_id, make_word(0), 0)

        with pytest.raises(GameError) as excinfo:
            game.start_round(room, room.master_id, make_word(1), 0)
        assert excinfo.value.code == "wrong_phase"

    def test_rejects_answer_outside_round_active(self):
        room = started_room()
        with pytest.raises(GameError) as excinfo:
            game.answer_correct(room, room.master_id, "p1")
        assert excinfo.value.code == "wrong_phase"


class TestSettings:
    @pytest.mark.parametrize("seconds", [30, 60, 90, 120])
    def test_accepts_allowed_time_limits(self, seconds):
        room = make_room()
        game.update_settings(room, HOST_ID, time_limit_sec=seconds)
        assert room.settings.time_limit_sec == seconds

    @pytest.mark.parametrize("seconds", [0, 45, 300])
    def test_rejects_other_time_limits(self, seconds):
        room = make_room()
        with pytest.raises(GameError) as excinfo:
            game.update_settings(room, HOST_ID, time_limit_sec=seconds)
        assert excinfo.value.code == "invalid_settings"

    @pytest.mark.parametrize("laps", [0, 6])
    def test_rejects_out_of_range_laps(self, laps):
        room = make_room()
        with pytest.raises(GameError) as excinfo:
            game.update_settings(room, HOST_ID, total_laps=laps)
        assert excinfo.value.code == "invalid_settings"

    def test_rejects_change_after_game_started(self):
        room = started_room()
        with pytest.raises(GameError) as excinfo:
            game.update_settings(room, HOST_ID, total_laps=3)
        assert excinfo.value.code == "wrong_phase"

    def test_defaults_to_60_seconds_and_2_laps(self):
        room = make_room()
        assert room.settings.time_limit_sec == 60
        assert room.settings.total_laps == 2


class TestRestart:
    def finished_room(self) -> Room:
        room = started_room(player_count=3)
        while room.phase != "finished":
            play_round(room)
            if room.phase == "round_result":
                advance(room)
        return room

    def test_clears_scores_and_progress(self):
        room = self.finished_room()
        game.restart_game(room, HOST_ID)

        assert room.phase == "round_ready"
        assert room.rounds_played == 0
        assert all(p.score == 0 for p in room.players)

    def test_keeps_used_words_to_avoid_repeats(self):
        room = self.finished_room()
        used_before = list(room.used_word_ids)

        game.restart_game(room, HOST_ID)

        assert room.used_word_ids == used_before

    def test_rejects_restart_before_game_over(self):
        room = started_room()
        with pytest.raises(GameError) as excinfo:
            game.restart_game(room, HOST_ID)
        assert excinfo.value.code == "wrong_phase"


class TestDisconnectedMaster:
    def test_anyone_can_advance_while_master_is_offline(self):
        """マスターが戻らなくても進行が止まらない。"""
        room = started_room()
        game.set_connected(room, room.master_id, False)

        game.start_round(room, "p2", make_word(0), 0)

        assert room.phase == "round_active"

    def test_blocks_others_while_master_is_online(self):
        room = started_room()
        with pytest.raises(GameError) as excinfo:
            game.start_round(room, "p2", make_word(0), 0)
        assert excinfo.value.code == "not_master"

    def test_offline_master_can_still_act_after_reconnect(self):
        room = started_room()
        game.set_connected(room, room.master_id, False)
        game.join(room, room.master_id, "プレイヤー0")

        with pytest.raises(GameError):
            game.start_round(room, "p2", make_word(0), 0)
