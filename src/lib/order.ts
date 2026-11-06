// Content collections come back sorted by id; the site keeps the order of the YAML file instead.
export function inFileOrder<T extends { id: string }>(items: T[], raw: string) {
	const order = [...raw.matchAll(/^[\s-]*id:\s*["']?([^"'\s#]+)/gm)].map((m) => m[1]);
	return items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}
