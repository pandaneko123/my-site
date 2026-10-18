# ブログの処理フロー

記事を書いてから公開されるまでの流れ。`pnpm blog:publish` は「変換 → ビルド確認 → コミット → push」をまとめて行う。

```mermaid
flowchart LR
	subgraph PC["自分のPC（Windows）"]
		O["Obsidian<br>Blog/・Blog/Pages/"] --> S["blog:sync<br>変換してコピー"]
		S --> M["my-site（Astro）<br>git リポジトリ"]
		M --> D["pnpm dev<br>localhost:4321 で確認"]
	end
	subgraph NET["インターネット"]
		G["GitHub<br>pandaneko123/my-site"] --> C["Cloudflare Pages<br>自動でビルド・公開"]
		C --> R["読者のブラウザ<br>my-site-c4e.pages.dev"]
	end
	M -- git push --> G
```

| 段階 | やること | コマンド |
|---|---|---|
| 書く | Obsidian の `My knowledge/Blog/`（ページは `Blog/Pages/`）に `.md` を書く | — |
| 変換 | Obsidian の書き方を Astro 用に直し、`src/content/` にコピー | `pnpm blog:sync` |
| 確認 | 公開前の見た目を手元で見る | `pnpm dev` |
| 公開 | 変換・ビルド確認・コミット・push をまとめて実行。push を受けて Cloudflare Pages が自動で公開 | `pnpm blog:publish` |
