// Obsidian の「Blog」フォルダの記事を src/content/blog/ に、
// 「Blog/Pages」フォルダのページ（About など）を src/content/pages/ にコピーする。
// 元データは Obsidian 側。src/content/ の2つのフォルダは毎回作り直すので、直接編集しないこと。
//
// 使い方: pnpm blog:sync
// --no-drafts を付けると下書き（draft: true / publish: false）をコピーしない。
// GitHub のリポジトリは公開なので、pnpm blog:publish はこれを付けて下書きをコミットしないようにしている。
// Obsidian のフォルダは環境変数 OBSIDIAN_BLOG_DIR で変更できる。

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT_DIR = path.resolve(ROOT, '../../obsidian/My knowledge');
const SOURCE_DIR = process.env.OBSIDIAN_BLOG_DIR ?? path.join(VAULT_DIR, 'Blog');
const PAGES_SOURCE_DIR = path.join(SOURCE_DIR, 'Pages');
const BLOG_OUT_DIR = path.join(ROOT, 'src/content/blog');
const PAGES_OUT_DIR = path.join(ROOT, 'src/content/pages');
const ROUTES_DIR = path.join(ROOT, 'src/pages');
const ASSET_DIR_NAME = '_assets';
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const SKIP_DRAFTS = process.argv.includes('--no-drafts');

if (!existsSync(SOURCE_DIR)) {
	console.error(`Obsidian のフォルダが見つかりません: ${SOURCE_DIR}`);
	process.exit(1);
}

/** ディレクトリ以下のファイルを再帰的に列挙（.obsidian などの隠しフォルダは除く） */
function walk(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (entry.name.startsWith('.')) return [];
		const full = path.join(dir, entry.name);
		return entry.isDirectory() ? walk(full) : [full];
	});
}

function splitFrontmatter(text) {
	const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!m) return { data: {}, body: text };
	return { data: YAML.parse(m[1]) ?? {}, body: text.slice(m[0].length) };
}

function toDateString(value) {
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return String(value);
}

function toSlug(name) {
	return name
		.trim()
		.replace(/[\s　]+/g, '-')
		.replace(/[\\/?#%"<>|:*]/g, '');
}

/** コードブロックの外側だけに変換をかける */
function mapOutsideCode(body, fn) {
	return body
		.split(/(^```[\s\S]*?^```)/m)
		.map((part, i) => (i % 2 === 1 ? part : fn(part)))
		.join('');
}

/** 本文の最初の段落から説明文を作る */
function makeDescription(body) {
	const line = body
		.split(/\r?\n/)
		.map((l) => l.trim())
		.find((l) => l && !l.startsWith('#') && !l.startsWith('```') && !l.startsWith('>') && !l.startsWith('!'));
	if (!line) return '';
	const plain = line
		.replace(/^[-*+]\s+|^\d+\.\s+/, '')
		.replace(/!?\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/[*_`=~]/g, '');
	return plain.length > 80 ? `${plain.slice(0, 80)}…` : plain;
}

function findDuplicates(values) {
	return [...new Set(values.filter((v, i, all) => all.indexOf(v) !== i))];
}

// 画像は保管庫全体（と Blog フォルダ）から探す
const vaultFiles = [...new Set([...walk(SOURCE_DIR), ...walk(VAULT_DIR)])];
const isUnder = (file, dir) => !path.relative(dir, file).startsWith('..');
const pageFiles = walk(PAGES_SOURCE_DIR).filter((f) => f.endsWith('.md'));
const postFiles = walk(SOURCE_DIR).filter((f) => f.endsWith('.md') && !isUnder(f, PAGES_SOURCE_DIR));

// 記事・ページを読み込み、先に URL を確定させる（記事同士のリンクに使う）
function loadNote(file, kind) {
	const name = path.basename(file, '.md');
	const { data, body } = splitFrontmatter(readFileSync(file, 'utf-8'));
	const slug = toSlug(String(data.slug ?? name));
	const draft = data.draft === true || data.publish === false;
	return kind === 'post'
		? { kind, file, name, data, body, slug, draft, outDir: BLOG_OUT_DIR, url: `/blog/${slug}/` }
		: { kind, file, name, data, body, slug, draft, outDir: PAGES_OUT_DIR, url: `/${slug}/` };
}
const allPosts = postFiles.map((f) => loadNote(f, 'post'));
const allPages = pageFiles.map((f) => loadNote(f, 'page'));
const isIncluded = (n) => !(SKIP_DRAFTS && n.draft);
const posts = allPosts.filter(isIncluded);
const pages = allPages.filter(isIncluded);
const notes = [...posts, ...pages];
// 下書きを外したときは、下書きへのリンクも文字だけになる
const urlByName = new Map(notes.map((n) => [n.name, n.url]));

const duplicated = [...findDuplicates(allPosts.map((n) => n.slug)), ...findDuplicates(allPages.map((n) => n.slug))];
if (duplicated.length > 0) {
	console.error(`URL（slug）が重複しています: ${duplicated.join(', ')}`);
	process.exit(1);
}

// src/pages/ にある既存のページ（blog, tags など）と同じ URL のページは作れない
const reserved = new Set(
	readdirSync(ROUTES_DIR)
		.filter((n) => !n.startsWith('['))
		.map((n) => n.replace(/\.(astro|md|mdx|js|ts)$/, '')),
);
const conflicted = pages.filter((p) => reserved.has(p.slug)).map((p) => p.slug);
if (conflicted.length > 0) {
	console.error(`既存のページと URL がかぶっています（ファイル名か slug を変えてください）: ${conflicted.join(', ')}`);
	process.exit(1);
}

for (const dir of [BLOG_OUT_DIR, PAGES_OUT_DIR]) {
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(path.join(dir, ASSET_DIR_NAME), { recursive: true });
}

// 画像は記事・ページそれぞれの出力先の _assets/ にコピーする
const copiedImages = new Map([
	[BLOG_OUT_DIR, new Set()],
	[PAGES_OUT_DIR, new Set()],
]);
function copyImage(fileName, outDir) {
	const found = vaultFiles.find((f) => path.basename(f) === path.basename(fileName));
	if (!found) {
		console.warn(`  画像が見つかりません: ${fileName}`);
		return null;
	}
	const outName = path.basename(found);
	const copied = copiedImages.get(outDir);
	if (!copied.has(outName)) {
		copyFileSync(found, path.join(outDir, ASSET_DIR_NAME, outName));
		copied.add(outName);
	}
	return `./${ASSET_DIR_NAME}/${encodeURI(outName)}`;
}

function convertObsidianSyntax(body, outDir) {
	return mapOutsideCode(body, (text) =>
		text
			// %%コメント%% は公開しない
			.replace(/%%[\s\S]*?%%/g, '')
			// ![[画像.png]] / ![[画像.png|300]]
			.replace(/!\[\[([^\]|]+?)(\|[^\]]*)?\]\]/g, (all, target) => {
				if (!IMAGE_EXT.test(target)) return target;
				const src = copyImage(target, outDir);
				return src ? `![](${src})` : '';
			})
			// 通常の Markdown 画像でもローカル画像ならコピーする
			.replace(/!\[([^\]]*)\]\((?!https?:)([^)]+)\)/g, (all, alt, target) => {
				const src = copyImage(decodeURI(target), outDir);
				return src ? `![${alt}](${src})` : all;
			})
			// [[記事名]] / [[記事名|表示名]] / [[記事名#見出し]]
			.replace(/\[\[([^\]|#]+)(#[^\]|]*)?(\|[^\]]*)?\]\]/g, (all, target, heading, alias) => {
				const label = alias ? alias.slice(1) : target;
				const url = urlByName.get(target.trim());
				return url ? `[${label}](${url})` : label;
			})
			// ==ハイライト==
			.replace(/==([^=\n]+)==/g, '<mark>$1</mark>'),
	);
}

for (const note of notes) {
	let body = note.body.replace(/^\s+/, '');
	let title = note.data.title;
	// 先頭の # 見出しはタイトルとして扱い、本文からは外す
	const h1 = body.match(/^#\s+(.+)\r?\n/);
	if (h1) {
		title ??= h1[1].trim();
		body = body.slice(h1[0].length).replace(/^\s+/, '');
	}
	title ??= note.name;
	const { draft } = note;

	let frontmatter = {
		title: String(title),
		description: String(note.data.description ?? makeDescription(body)),
	};
	if (note.kind === 'post') {
		const dateFromName = note.name.match(/\d{4}-\d{2}-\d{2}/)?.[0];
		const pubDate = note.data.pubDate ?? note.data.date ?? dateFromName ?? statSync(note.file).mtime;
		const updated = note.data.updatedDate ?? note.data.updated;
		const tags = note.data.tags == null ? [] : [note.data.tags].flat().map(String);
		frontmatter = {
			...frontmatter,
			pubDate: toDateString(pubDate),
			...(updated ? { updatedDate: toDateString(updated) } : {}),
			tags,
		};
	}
	if (draft) frontmatter.draft = true;

	const output = `---\n${YAML.stringify(frontmatter)}---\n\n${convertObsidianSyntax(body, note.outDir)}`;
	writeFileSync(path.join(note.outDir, `${note.slug}.md`), output);
	console.log(`  ${draft ? '[下書き] ' : ''}${path.relative(SOURCE_DIR, note.file)} → ${note.url}`);
}

for (const [dir, copied] of copiedImages) {
	if (copied.size === 0) rmSync(path.join(dir, ASSET_DIR_NAME), { recursive: true });
}
const imageCount = [...copiedImages.values()].reduce((sum, s) => sum + s.size, 0);
console.log(`${posts.length} 件の記事、${pages.length} 件のページ、${imageCount} 件の画像をコピーしました。`);
const skipped = allPosts.length + allPages.length - notes.length;
if (skipped > 0) console.log(`下書き ${skipped} 件はコピーしていません（--no-drafts）。`);
