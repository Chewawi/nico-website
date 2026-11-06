export const SITE_TITLE = 'mrnico12';
export const SITE_DESCRIPTION =
	'Drawings, doodles and characters by Nicolas (mrnico12), a self-taught uruguayan artist.';

type Social = { id: 'instagram' | 'bluesky' | 'email' | 'discord'; name: string; handle: string; href?: string };

export const SOCIALS: Social[] = [
	{ id: 'instagram', name: 'Instagram', handle: '@mrnico12', href: 'https://www.instagram.com/mrnico12/' },
	{ id: 'bluesky', name: 'Bluesky', handle: '@mrnico12.bsky.social', href: 'https://bsky.app/profile/mrnico12.bsky.social' },
	{ id: 'email', name: 'Email', handle: 'email' },
	{ id: 'discord', name: 'Discord', handle: 'mrnico12' },
];

// The address is stored backwards and put together in the browser, so it never sits in the HTML as plain text.
export const MAIL = { user: '217anutnasalocin', domain: 'moc.liamg' };

// Links carried over from the old straw.page easter eggs.
export const LINKS = {
	uruguay: 'https://www.youtube.com/watch?v=c5CQgsFJm0c',
	sunflower: 'https://www.youtube.com/watch?v=v6ofxD4fLms',
} as const;

export const NAV = [
	{ href: '/', label: 'Art' },
	{ href: '/about/', label: 'About' },
	{ href: '/contact/', label: 'Contact' },
	{ href: '/guestbook/', label: 'Guestbook' },
] as const;
