# 湯川サッカースケジュール管理アプリ

## 重要：フォームフィールド変更時のルール

**フォームのフィールドを追加・削除・名称変更した場合は、必ず `claude-project.md` も同じコミットで更新すること。**

`claude-project.md` は Claude.ai Project instructions として使用される。
ユーザーはこのファイルの git 差分を見て Claude.ai に反映するかどうか判断する。

## アプリ概要

- ホスティング: GitHub Pages (`https://yupaki8.github.io/yugawa-soccer/`)
- データ: Google Apps Script 経由でスプレッドシートに保存
- 構成: `index.html` 1ファイル完結、`apps-script.js` はGAS貼り付け用

## フォームフィールド一覧（URLパラメータ名）

| パラメータ | 要素ID | 型 | 説明 |
|---|---|---|---|
| team | - | fa/chu | チーム（湯川FA/湯川中学校） |
| type | - | of/tr/cu/ot | 種別（公式戦/TRM/カップ戦/その他） |
| cat | f-cat | select | カテゴリ（U15/U12/U11/U10/その他） |
| date | f-dt | date | 日付 YYYY-MM-DD |
| ttl | f-ttl | text | タイトル/大会名 |
| ga | f-ga | time | 集合時間（クラブハウス） |
| gv | f-gv | time | 集合時間（会場） |
| dismiss | f-dismiss | time | 解散予定時刻 |
| ve | f-ve | text | 会場名 |
| vemap | f-vemap | url | Google マップURL |
| gl | f-gl | text | 集合場所 |
| opponents | f-opponents | textarea | 対戦相手一覧（複数行） |
| fee | f-fee | text | 参加費・交通費 |
| imgurl | f-imgurl | hidden | 元データ画像のDrive URL（自動入力） |
| mo | f-mo | textarea | 持ち物・メモ |
| results | (動的生成) | JSON | 試合結果（試合毎：opp/us/th/scorers） |

| dateend | f-dt-end | date | 終了日（複数日開催時のみ。新規登録時のみ表示） |

`results`・`imgurl` はURLパラメータ非対応（`results` は試合後入力、`imgurl` はDrive経由自動生成）。

`dateend`/`f-dt-end` に値を入れると、保存時に開始日〜終了日の各日付で同内容のイベントを個別登録する（複数日開催の一括登録用）。スプレッドシート未保存（保存時に展開されて消える一時フィールド）。編集時は非表示。

## スプレッドシートスキーマ（eventsシート）

`id, team, type, ttl, date, cat, ga, gv, dismiss, ve, vemap, gl, opponents, fee, imgurl, results, mo`
