// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';

// https://astro.build/config
export default defineConfig({
	// 公開URL（独自ドメインを付けたらここを書き換える）
	site: 'https://my-site-c4e.pages.dev',
	integrations: [mdx(), sitemap()],
	// Obsidian と同じく、1行の改行もそのまま改行として表示する
	markdown: {
		remarkPlugins: [remarkBreaks],
	},
});
