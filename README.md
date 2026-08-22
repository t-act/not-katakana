# カタカナ抜き

外来語のお題を、外来語を一切使わずに説明して当ててもらう言葉当てゲーム。
同じ場所に集まって遊ぶための**対面プレイ支援アプリ**です。

説明も回答も声で行います。アプリが引き受けるのは **お題の配布・持ち時間・得点** の 3 つだけで、
各自のスマートフォンが手札の代わりになります。お題が映るのは説明役の画面だけです。

## 遊び方

| 項目 | 決まり |
| --- | --- |
| 人数 | 3〜6 人 |
| 持ち時間 | 既定 60 秒 (30・60・90・120 から選択) |
| 得点 | 当てた人に 1 点。説明役には入らない |
| 交代 | 参加順に時計回り |
| 終わり | 全員が同じ回数だけ説明役をつとめたら終了 (既定 2 周) |
| 失敗 | 時間切れ / 説明役があきらめる → 誰にも点は入らない |

カタカナを使ってしまったかどうかはアプリでは判定しません。その場で耳で聞いて指摘し、
説明役が自分で「あきらめる」を押します。ボタンを置くと誤タップと押し合いの駆け引きが生まれ、
声で済む話が操作の問題にすり替わるためです。

得点源が当てることだけなので、説明役は説明を通しても得をしません。
全員が同じ回数だけ説明役をつとめる周回制と組み合わせることで、加点の機会が全員に等しく配られます。

## 構成

```
Cloudflare Worker (Python)
├── 静的アセット  … React + TypeScript + Vite の PWA
├── FastAPI       … POST /api/rooms でルームコードを発行
└── /ws/{code}    … ルームごとの Durable Object へ転送
                     ├── WebSocket Hibernation で全員の接続を保持
                     ├── SQLite storage に状態を永続化
                     └── Alarm API で持ち時間の締切を発火
```

フロントと API を同じ Worker に載せているため、同一オリジンになり CORS 設定も接続先の切り替えも不要です。

### 設計上の要点

**お題は説明役の接続にしか送りません。** 状態のブロードキャストは接続ごとに組み立て直し、
説明役以外へのメッセージからは `current_word` を取り除きます。画面に出さないだけでは、
隣の人が開発者ツールを開いた時点で見えてしまうためです。

**持ち時間は絶対時刻で配ります。** サーバーは残り秒数ではなく締切の時刻 (epoch ミリ秒) を配り、
端末側は接続時に受け取ったサーバー時刻との差で補正します。並べて置いた画面の数字が食い違うと
対面では興ざめするためです。締切の確定は Durable Object の `alarm()` だけが行います。

**排他制御は書いていません。** Durable Object は単一スレッドで直列に処理されるため、
「正解のタップ」と「締切の発火」が同時に起きても二重に採点されることが構造的にありません。

## 開発

必要なもの: [uv](https://docs.astral.sh/uv/) 0.12.3 以上、Node.js 22 以上。

```bash
uv sync
cd frontend && npm install && cd ..

# 端末 1: Worker (API と WebSocket)
uv run pywrangler dev --port 8787

# 端末 2: フロント (8787 へ自動で転送される)
cd frontend && npm run dev
```

`http://localhost:5173` を開きます。同じ場所の別の端末から試すときは `npm run dev -- --host` を使ってください。

## テスト

```bash
uv run pytest                 # ゲームルール (Workers ランタイム不要)
cd frontend && npm run build  # 型検査とビルド
```

ルールは `backend/src/game.py` に I/O なしで閉じてあるので、Workers を起動せずに検証できます。

実際の Worker を相手にした通し確認:

```bash
uv run --with websockets python scripts/e2e_game_flow.py  # 参加から再戦まで
uv run --with websockets python scripts/e2e_timer.py      # 締切と認証 (30 秒待ちます)
```

`scripts/bot.py` は画面を触りながら動作を見たいときの相手役です。

```bash
uv run --with websockets python scripts/bot.py <ルームコード> みか
```

## デプロイ

```bash
cd frontend && npm run build && cd ..
uv run pywrangler deploy
```

Durable Objects は Workers の無料プランでも SQLite バックエンドなら使えるため、
数人が時々遊ぶ範囲では無料枠に収まります。

## お題について

`backend/src/words_data.py` の 160 語は、選定から難易度づけまですべて自前で用意したものです。
選んだ基準は「外来語を一切使わずに日本語で説明しきれること」。
説明の逃げ道がない固有名詞や商標は入れていません。
