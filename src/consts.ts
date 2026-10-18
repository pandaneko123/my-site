// サイト全体の設定。どのファイルからも import して使える。

export const SITE_TITLE = 'My Blog';
export const SITE_DESCRIPTION = '日々のメモと、作ったものの置き場所。';
export const SITE_AUTHOR = 'pandaneko';
export const SITE_LANG = 'ja';

// ヘッダーのナビゲーション。ページを増やしたらここに1行足す。
export const NAV_LINKS = [
	{ href: '/', label: 'ホーム' },
	{ href: '/blog', label: 'ブログ' },
	{ href: '/tags', label: 'タグ' },
	{ href: '/about', label: 'About' },
];
