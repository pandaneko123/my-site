import { type CollectionEntry, getCollection } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** 公開対象の記事を新しい順で返す。下書きは開発サーバーでのみ含める。 */
export async function getPosts(): Promise<Post[]> {
	const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
	return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** タグごとの記事数を多い順で返す。 */
export function countTags(posts: Post[]): [string, number][] {
	const counts = new Map<string, number>();
	for (const post of posts) {
		for (const tag of post.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	}
	return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'));
}
