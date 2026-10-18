# my-site

Astro で作った個人ブログ。Cloudflare Pages で公開する。

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `pnpm dev` | 開発サーバー起動（http://localhost:4321、下書きも表示） |
| `pnpm build` | 本番用に `dist/` へビルド |
| `pnpm preview` | ビルド結果をローカルで確認 |

## 記事の書き方

`src/content/blog/` に `.md`（または `.mdx`）を置く。ファイル名が URL になる（`hello-world.md` → `/blog/hello-world/`）。

```md
---
title: '記事タイトル'
description: '一覧や検索結果に出る説明文'
pubDate: '2026-10-18'
tags: ['タグ1', 'タグ2']   # 省略可
draft: true               # 省略可。true なら公開されない
---

本文
```

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
