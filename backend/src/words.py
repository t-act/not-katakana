"""お題の抽選。

語彙そのものは words_data.py が持つ。Workers ランタイムでのファイル読み込みに
依存したくないため、JSON ファイルではなく Python モジュールとして同梱している。
"""

from collections.abc import Collection, Sequence
from random import Random

from models import Word
from words_data import WORD_ENTRIES

_CACHED_WORDS: list[Word] | None = None


def all_words() -> list[Word]:
    """語彙一覧を返す。初回だけ組み立てて以降は使い回す。

    モジュール読み込み時ではなく初回呼び出し時に作る。Python Workers は
    デプロイ時にトップレベルのコードを実行するため、そこでの作業を減らす。
    """
    global _CACHED_WORDS
    if _CACHED_WORDS is None:
        _CACHED_WORDS = [Word(**entry) for entry in WORD_ENTRIES]
    return _CACHED_WORDS


def pick_word(words: Sequence[Word], used_word_ids: Collection[str], rng: Random) -> Word:
    """未使用の語から 1 つ選ぶ。全て使い切っていれば全体から選び直す。

    rng を引数で受け取るのは、モジュール読み込み時の乱数生成を Python Workers が
    禁じているため。呼び出しのたびに Random() を作る形にしている。
    """
    if not words:
        raise ValueError("お題が 1 つも登録されていません")

    unused = [w for w in words if w.id not in used_word_ids]
    return rng.choice(unused or list(words))
