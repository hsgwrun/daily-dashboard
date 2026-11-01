# 今日のボード — Daily Dashboard

毎日開きたくなる、日本語のパーソナル・ダッシュボードです。時計・天気・カレンダー・タスク・メモをひとつの画面にまとめています。

## 機能

- **現在時刻** — 日本標準時の時計と、年間の進み具合（残り日数つき）
- **天気** — Open-Meteo による現在の気温・体感温度・湿度・風、今日の最高・最低気温・降水確率、これから24時間の気温グラフ
- **週間天気** — これから7日間の天気アイコンと気温
- **日の出・日の入り・月齢** — 「あと◯時間で日の入り」、今夜の月の満ち欠き
- **カレンダー** — 日本の祝日表示（holidays-jp）、今日のハイライト
- **今日のタスク** — 追加・完了・削除、ブラウザに自動保存
- **今日の言葉** — 日替わりのことわざ・名言
- **今日の遊び（餅つきゲーム）** — 杵がもちに近い瞬間をねらう timing ゲーム。8回まいたら完成、ランクはS（神業）からC（もちのような心）まで
- **ちょっとした小言** — 時間帯・天気・タスクの状況に合わせて、ダッシュボードが一言だけ言います（しつこくは言いません）
- **メモ** — 自動保存の簡単メモ
- **テーマ** — 和紙（ライト）と墨（ダーク）の切り替え
- **PWA対応** — スマホのホーム画面に追加でき、オフラインでも時計とカレンダーが動きます

## 使い方

### GitHub Pages で見る

このリポジトリの GitHub Pages（`main` ブランチ）が有効になっていれば、以下で開けます。

```
https://hsgwrun.github.io/daily-dashboard/
```

### ローカルで動かす

ビルド不要の静的サイトです。リポジトリをクローンして `index.html` をブラウザで開くだけです。

```bash
git clone https://github.com/hsgwrun/daily-dashboard.git
cd daily-dashboard
# index.html を開く（または任意の静的サーバーで配信）
```

## 技術

- HTML / CSS / JavaScript のみ（フレームワークなし、ビルドなし）
- 天気: [Open-Meteo API](https://open-meteo.com/)（APIキー不要）
- 祝日: [holidays-jp](https://github.com/holidays-jp/holidays-jp)
- フォント: Zen Kaku Gothic New / Shippori Mincho（Google Fonts）
- タスクとメモはブラウザの localStorage に保存されます（サーバー送信なし）

## ファイル構成

```
index.html   — 画面の構造
style.css    — デザイン（和紙×墨×朱色）
app.js       — 時計・天気・カレンダー・タスク・メモ・小言のロジック
game.js      — 餅つきゲーム
sw.js        — サービスワーカー（オフライン対応）
manifest.json / icons/ — PWAのホーム画面追加用
gen-icons.js — アイコンPNGを生成するスクリプト（node gen-icons.js）
```

## ライセンス

MIT
