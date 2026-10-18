# システム構成

どこに何があって、何が動いているか。処理の流れは [blog-flow.md](blog-flow.md) を参照。

```mermaid
flowchart TB
	subgraph PC["自分のPC（Windows 10）"]
		O["Obsidian 保管庫<br>記事の元データ"] --> L["ローカルリポジトリ<br>Astro 7・Node 24"]
		L --> D["開発サーバー<br>astro dev（Vite）"]
	end
	subgraph GH["GitHub"]
		G["リモートリポジトリ<br>pandaneko123/my-site"]
	end
	subgraph CF["Cloudflare Pages（無料プラン）"]
		B["ビルド環境<br>pnpm build → dist/"] --> N["CDN（Web 配信）<br>静的ファイル・HTTPS"]
	end
	L -- git push --> G
	G -- push を検知 --> B
	N --> R["読者のブラウザ<br>my-site-c4e.pages.dev"]
```

## 構成要素

| 場所 | 要素 | 中身 |
|---|---|---|
| 自分のPC | Obsidian 保管庫 | `C:\Users\pannd\obsidian\My knowledge`。記事は `Blog/`、ページは `Blog/Pages/`。git では管理していない |
| 自分のPC | ローカルリポジトリ | `C:\Users\pannd\dev\my-site`。Astro 7.4 / Node 24 / pnpm 12 / Git 2.55 |
| 自分のPC | 開発サーバー | `pnpm dev`（中身は Astro と Vite）。`http://localhost:4321`。自分のPCからだけ見られる |
| GitHub | リモートリポジトリ | `https://github.com/pandaneko123/my-site`、`main` ブランチ |
| Cloudflare | ビルド環境 | `main` への push を検知して、`pnpm build` で `dist/` を作る。Node のバージョンは `.node-version`、pnpm は `package.json` の `packageManager` で固定している |
| Cloudflare | CDN（Web 配信） | `dist/` の静的ファイルを世界中の拠点から配信する。自分で管理する Web サーバーはない。HTTPS も自動 |
| インターネット | 公開 URL | `https://my-site-c4e.pages.dev`（独自ドメインを付けたら `astro.config.mjs` の `site` を書き換える） |

費用はすべて無料プランの範囲。
