# my-site

Astro で作った個人ブログ。Cloudflare Pages で公開する。

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー起動（http://localhost:4321、下書きも表示） |
| `pnpm build` | 本番用に `dist/` へビルド |
| `pnpm preview` | ビルド結果をローカルで確認 |

## 記事の書き方（Obsidian で書く）

記事の元データは Obsidian の `My knowledge/Blog/` フォルダ。
`src/content/blog/` は毎回作り直されるので、**直接編集しない**こと。

1. Obsidian の `My knowledge/Blog/` に `.md` を書く（直すときもここを直す）
2. `pnpm blog:publish` を実行（コピー → ビルド確認 → コミット → push）

コピーだけして手元で見たいときは `pnpm blog:sync` のあと `pnpm dev`。

### 記事の先頭情報（すべて省略可）

```md
---
date: 2026-10-18          # 公開日。省略時はファイル名の日付 → 更新日時
tags: [日記, 住まい探し]
title: 記事タイトル        # 省略時は本文先頭の「# 見出し」→ ファイル名
description: 説明文        # 省略時は本文の最初の段落
slug: my-post             # URL（/blog/my-post/）。省略時はファイル名
updated: 2026-10-20       # 更新日
draft: true               # true なら公開しない（pnpm dev では表示）
---
```

### About などのページ

`My knowledge/Blog/Pages/` に置いた `.md` はブログ記事ではなく単独のページになる（`about.md` → `/about/`）。
先頭情報は `title` `description` `slug` `draft` が使える。`blog` `tags` など既存のページと同じ URL は作れない。
メニューに出すときは `src/consts.ts` の `NAV_LINKS` に1行足す。

### Obsidian の書き方の変換

- `[[記事名]]` `[[記事名|表示名]]` … Blog フォルダ内の記事ならリンク、それ以外は文字だけ残す
- `![[画像.png]]` … 保管庫から画像を探してコピー
- `%%コメント%%` … 公開しない
- `==ハイライト==` … マーカー表示

## 構成

- `src/consts.ts` … サイト名・説明・ナビゲーション
- `src/layouts/BaseLayout.astro` … 全ページ共通の外枠。新しいページはこれで囲む
- `src/pages/` … ここにファイルを置くとページになる（例: `src/pages/tools/foo.astro` → `/tools/foo/`）

### ページを追加するとき

1. `src/pages/` に `.astro` ファイルを作り、`BaseLayout` で囲む
2. `src/consts.ts` の `NAV_LINKS` に1行足す

## 公開（Cloudflare Pages）

1. GitHub にリポジトリを作って push
2. Cloudflare ダッシュボード → Workers & Pages → Create → Pages → Git に接続
3. ビルド設定: Framework preset `Astro` / Build command `pnpm build` / Output `dist`
4. 公開URLが決まったら `astro.config.mjs` の `site` を書き換える
