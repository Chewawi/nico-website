export const SITE_TITLE = 'mrnico12';
export const SITE_DESCRIPTION =
	'Drawings, doodles and characters by Nicolas (mrnico12), a self-taught uruguayan artist.';

export const SOCIALS = [
	{ name: 'Instagram', handle: '@mrnico12', href: 'https://www.instagram.com/mrnico12/' },
	{ name: 'Bluesky', handle: '@mrnico12.bsky.social', href: 'https://bsky.app/profile/mrnico12.bsky.social' },
] as const;

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
