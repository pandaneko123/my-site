// 訪問者数カウンターの API（Cloudflare Pages Functions）。
// Cloudflare の D1 データベースを「DB」という名前で Pages プロジェクトに結び付けて使う。
//
//   GET  /api/views?path=/blog/foo/          数を読むだけ
//   POST /api/views  {"path": "/blog/foo/", "newVisit": true}   数を増やしてから読む
//
// 返す値: { page: そのページの累計閲覧数, today: 今日の訪問者数, total: 累計訪問者数 }
// 「訪問者」はブラウザのセッションごとに 1 回、「閲覧」はセッションごと・ページごとに 1 回数える（重複はブラウザ側で除く）。
//
// テーブルは集計済みの行だけを持つ（読むのは主キーで 3 行だけ）:
//   (path, 'total')  ページごとの累計
//   ('*',  日付)     サイト全体のその日の訪問者数（日本時間）
//   ('*',  'total')  サイト全体の累計訪問者数

const SITE = '*';
const TOTAL = 'total';

const SCHEMA = `CREATE TABLE IF NOT EXISTS page_views (
	path TEXT NOT NULL,
	day TEXT NOT NULL,
	count INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (path, day)
)`;

const INCREMENT = `INSERT INTO page_views (path, day, count) VALUES (?1, ?2, 1)
	ON CONFLICT (path, day) DO UPDATE SET count = count + 1`;

const READ = 'SELECT count FROM page_views WHERE path = ?1 AND day = ?2';

/** 日本時間の今日の日付（YYYY-MM-DD） */
function todayJst() {
	return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * サイト内のパスだけを受け付け、1 つのページが 1 つの書き方になるようにそろえる。
 * （/./ や /%62log/ のような書き方の違いで、同じページの行が増えないようにする）
 */
function normalizePath(raw) {
	if (typeof raw !== 'string' || !raw.startsWith('/') || raw.length > 300) return null;
	let path;
	try {
		// . や .. を解決し、不要なエンコードを戻してから、ブラウザと同じ形でエンコードし直す
		path = encodeURI(decodeURI(new URL(raw, 'https://example.invalid').pathname));
	} catch {
		return null;
	}
	path = path.replace(/\/{2,}/g, '/');
	if (!path.endsWith('/')) path += '/';
	return /^\/[A-Za-z0-9\-._~%/]*$/.test(path) ? path : null;
}

/** 実在するページか（存在しない URL を大量に送られて表が膨らむのを防ぐ） */
async function pageExists(env, request, path) {
	if (!env.ASSETS) return true;
	const res = await env.ASSETS.fetch(new URL(path, request.url), { method: 'HEAD' });
	return res.ok;
}

async function readCounts(db, path, day) {
	const [page, today, total] = await db.batch([
		db.prepare(READ).bind(path, TOTAL),
		db.prepare(READ).bind(SITE, day),
		db.prepare(READ).bind(SITE, TOTAL),
	]);
	const value = (result) => result.results[0]?.count ?? 0;
	return { page: value(page), today: value(today), total: value(total) };
}

function json(body, status = 200) {
	return Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	});
}

async function handle({ request, env }, increment) {
	if (!env.DB) return json({ error: 'DB が設定されていません' }, 503);

	let path;
	let newVisit = false;
	if (increment) {
		// JSON だけを受け付ける。ほかのサイトのページからこっそり送られる POST（フォームなど）を断るため
		if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
			return json({ error: 'Content-Type は application/json にしてください' }, 415);
		}
		const body = await request.json().catch(() => null);
		path = normalizePath(body?.path);
		newVisit = body?.newVisit === true;
	} else {
		path = normalizePath(new URL(request.url).searchParams.get('path'));
	}
	if (!path) return json({ error: 'path が正しくありません' }, 400);

	const db = env.DB;
	await db.prepare(SCHEMA).run();
	const day = todayJst();

	if (increment) {
		if (!(await pageExists(env, request, path))) return json({ error: 'ページが見つかりません' }, 404);
		const writes = [db.prepare(INCREMENT).bind(path, TOTAL)];
		if (newVisit) writes.push(db.prepare(INCREMENT).bind(SITE, day), db.prepare(INCREMENT).bind(SITE, TOTAL));
		await db.batch(writes);
	}

	return json(await readCounts(db, path, day));
}

export const onRequestGet = (context) => handle(context, false);
export const onRequestPost = (context) => handle(context, true);
