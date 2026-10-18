// Obsidian から記事・ページをコピー → ビルドで確認 → コミット → push までをまとめて行う。
//
// 使い方: pnpm blog:publish
// push すると Cloudflare Pages が自動でビルドして公開する。

import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run('node scripts/sync-obsidian.mjs');
run('pnpm build');

run('git add src/content/blog src/content/pages');
const changed = execSync('git diff --cached --name-only').toString().trim();
if (!changed) {
	console.log('記事に変更はありません。');
	process.exit(0);
}

run('git commit -m "Update blog posts"');
run('git push');
console.log('push しました。1分ほどで公開サイトに反映されます。');
