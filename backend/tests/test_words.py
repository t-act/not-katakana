"""お題抽選の検証。"""

from random import Random

import pytest
from models import Word
from words import all_words, pick_word

WORDS = [Word(id=f"w{i}", word=f"お題{i}") for i in range(3)]


class TestPickWord:
    def test_picks_from_unused_words(self):
        picked = pick_word(WORDS, used_word_ids={"w0", "w1"}, rng=Random(0))
        assert picked.id == "w2"

    def test_reuses_all_words_when_deck_exhausted(self):
        picked = pick_word(WORDS, used_word_ids={"w0", "w1", "w2"}, rng=Random(0))
        assert picked in WORDS

    def test_is_deterministic_for_a_fixed_seed(self):
        first = pick_word(WORDS, used_word_ids=set(), rng=Random(42))
        second = pick_word(WORDS, used_word_ids=set(), rng=Random(42))
        assert first == second

    def test_rejects_empty_deck(self):
        with pytest.raises(ValueError):
            pick_word([], used_word_ids=set(), rng=Random(0))


class TestWordDeck:
    def test_ids_are_unique(self):
        words = all_words()
        assert len({w.id for w in words}) == len(words)

    def test_words_are_unique(self):
        words = all_words()
        assert len({w.word for w in words}) == len(words)

    def test_has_enough_words_for_a_long_game(self):
        # 6 人 × 5 周 = 30 ラウンドを重複なく賄える量を最低ラインとする
        assert len(all_words()) >= 30
