// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	// 公開URL（独自ドメインを付けたらここを書き換える）
	site: 'https://my-site-c4e.pages.dev',
	integrations: [mdx(), sitemap()],
});
