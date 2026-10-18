// Obsidian の「Blog」フォルダの記事を src/content/blog/ にコピーする。
// 元データは Obsidian 側。src/content/blog/ は毎回作り直すので、直接編集しないこと。
//
// 使い方: pnpm blog:sync
// Obsidian のフォルダは環境変数 OBSIDIAN_BLOG_DIR で変更できる。

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT_DIR = path.resolve(ROOT, '../../obsidian/My knowledge');
const SOURCE_DIR = process.env.OBSIDIAN_BLOG_DIR ?? path.join(VAULT_DIR, 'Blog');
const OUT_DIR = path.join(ROOT, 'src/content/blog');
const ASSET_DIR_NAME = '_assets';
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

if (!existsSync(SOURCE_DIR)) {
	console.error(`Obsidian のフォルダが見つかりません: ${SOURCE_DIR}`);
	process.exit(1);
}

/** ディレクトリ以下のファイルを再帰的に列挙（.obsidian などの隠しフォルダは除く） */
function walk(dir) {
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

// 画像は保管庫全体（と Blog フォルダ）から探す
const vaultFiles = [...new Set([...walk(SOURCE_DIR), ...walk(VAULT_DIR)])];
const sourceFiles = walk(SOURCE_DIR).filter((f) => f.endsWith('.md'));

// 記事を読み込み、先にスラッグ（URL）を確定させる（記事同士のリンクに使う）
const notes = sourceFiles.map((file) => {
	const name = path.basename(file, '.md');
	const { data, body } = splitFrontmatter(readFileSync(file, 'utf-8'));
	return { file, name, data, body, slug: toSlug(String(data.slug ?? name)) };
});
const slugByName = new Map(notes.map((n) => [n.name, n.slug]));

const duplicated = notes.map((n) => n.slug).filter((s, i, all) => all.indexOf(s) !== i);
if (duplicated.length > 0) {
	console.error(`URL（slug）が重複しています: ${[...new Set(duplicated)].join(', ')}`);
	process.exit(1);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(path.join(OUT_DIR, ASSET_DIR_NAME), { recursive: true });

const copiedImages = new Set();
function copyImage(fileName) {
	const found = vaultFiles.find((f) => path.basename(f) === path.basename(fileName));
	if (!found) {
		console.warn(`  画像が見つかりません: ${fileName}`);
		return null;
	}
	const outName = path.basename(found);
	if (!copiedImages.has(outName)) {
		copyFileSync(found, path.join(OUT_DIR, ASSET_DIR_NAME, outName));
		copiedImages.add(outName);
	}
	return `./${ASSET_DIR_NAME}/${encodeURI(outName)}`;
}

function convertObsidianSyntax(body) {
	return mapOutsideCode(body, (text) =>
		text
			// %%コメント%% は公開しない
			.replace(/%%[\s\S]*?%%/g, '')
			// ![[画像.png]] / ![[画像.png|300]]
			.replace(/!\[\[([^\]|]+?)(\|[^\]]*)?\]\]/g, (all, target) => {
				if (!IMAGE_EXT.test(target)) return target;
				const src = copyImage(target);
				return src ? `![](${src})` : '';
			})
			// 通常の Markdown 画像でもローカル画像ならコピーする
			.replace(/!\[([^\]]*)\]\((?!https?:)([^)]+)\)/g, (all, alt, target) => {
				const src = copyImage(decodeURI(target));
				return src ? `![${alt}](${src})` : all;
			})
			// [[記事名]] / [[記事名|表示名]] / [[記事名#見出し]]
			.replace(/\[\[([^\]|#]+)(#[^\]|]*)?(\|[^\]]*)?\]\]/g, (all, target, heading, alias) => {
				const label = alias ? alias.slice(1) : target;
				const slug = slugByName.get(target.trim());
				return slug ? `[${label}](/blog/${slug}/)` : label;
			})
			// ==ハイライト==
			.replace(/==([^=\n]+)==/g, '<mark>$1</mark>'),
	);
}

for (const note of notes) {
	let body = note.body.replace(/^\s+/, '');
	let title = note.data.title;
	// 先頭の # 見出しは記事タイトルとして扱い、本文からは外す
	const h1 = body.match(/^#\s+(.+)\r?\n/);
	if (h1) {
		title ??= h1[1].trim();
		body = body.slice(h1[0].length).replace(/^\s+/, '');
	}
	title ??= note.name;

	const dateFromName = note.name.match(/\d{4}-\d{2}-\d{2}/)?.[0];
	const pubDate = note.data.pubDate ?? note.data.date ?? dateFromName ?? statSync(note.file).mtime;
	const updated = note.data.updatedDate ?? note.data.updated;
	const tags = note.data.tags == null ? [] : [note.data.tags].flat().map(String);
	const draft = note.data.draft === true || note.data.publish === false;

	const frontmatter = {
		title: String(title),
		description: String(note.data.description ?? makeDescription(body)),
		pubDate: toDateString(pubDate),
		...(updated ? { updatedDate: toDateString(updated) } : {}),
		tags,
		...(draft ? { draft: true } : {}),
	};

	const output = `---\n${YAML.stringify(frontmatter)}---\n\n${convertObsidianSyntax(body)}`;
	writeFileSync(path.join(OUT_DIR, `${note.slug}.md`), output);
	console.log(`  ${draft ? '[下書き] ' : ''}${path.relative(SOURCE_DIR, note.file)} → /blog/${note.slug}/`);
}

if (copiedImages.size === 0) rmSync(path.join(OUT_DIR, ASSET_DIR_NAME), { recursive: true });
console.log(`${notes.length} 件の記事、${copiedImages.size} 件の画像をコピーしました。`);
