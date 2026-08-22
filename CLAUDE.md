# 開発の進め方

## ブランチ戦略

トランクベース。`main` に直接コミットする。

- 一人で順番に進めるため、レビュー目的の pull request は作らない
- 枝を切るのは、途中の状態を `main` に置きたくない大きな変更のときだけ。切った場合も短命にして早くマージする
- `main` は常にデプロイできる状態に保つ

## コミットメッセージ

件名に Conventional Commits の型を付ける。付け忘れは `~/.config/git/hooks/commit-msg`
（グローバル設定）が commit の時点で弾く。

```
<型>: <内容>          feat: ルーム作成を追加する
<型>(<範囲>): <内容>  fix(ws): 再接続時の取りこぼしを直す
```

使う型は feat / fix / docs / test / ci / build / refactor / perf / style / chore / revert。
本文には Why を書く。何をしたかは差分を見ればわかる。

## 履歴の書き換え

公開リポジトリなので、force-push しても旧コミットは GitHub 上に GC 待ちで残る。
過去のメッセージを直したくなっても、原則そのままにして先へ進める。

## CI

`.github/workflows/ci.yml` が `main` への push と pull request で動く。
バックエンドは ruff と pytest、フロントエンドは tsc と vite build。
`main` を赤いまま放置しない。

## デプロイ

手動のみ。CI からは行わない。書きかけの変更がそのまま公開環境へ出るのを避けるため。
手順は README の「デプロイ」を参照。
