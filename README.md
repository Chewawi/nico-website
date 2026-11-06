# mrnico12

Portfolio of Nicolas (mrnico12): a gallery of drawings, an about page, contact links and a drawing guestbook.
Built with Astro and deployed to Cloudflare Workers. Everything is prerendered except the guestbook, which uses Cloudflare D1.

## Adding a drawing

1. Put the image in `src/content/works/images/` (PNG, JPG or WebP; bigger is fine, it gets resized).
2. Add an entry to `src/content/works/works.yaml`:

   ```yaml
   - id: sunflower            # unique, used in the link: /#sunflower
     title: Sunflower
     image: ./images/sunflower.png
     alt: A sunflower against a blue scribbled sky   # what the picture shows
     year: 2025
     medium: Digital
     category: illustration   # an id from src/content/categories.yaml
     featured: true           # optional: shows it bigger
   ```

The gallery shows works in the order of the file. Filter chips come from `src/content/categories.yaml`;
set `hidden: true` on a category to hide its chip and all of its works.

The placeholder images (`placeholder-*.jpg`) and their entries are there to exercise the layout. Delete them once the real
drawings are in. When the originals live in their own repo, copy them into `src/content/works/images/` before building.
The build only reads this folder.

## Commands

| Command | What it does |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Dev server with a local database (see the musl note below) |
| `bun run build` | Build to `dist/` |
| `bun run db:migrate:local` | Create the guestbook tables in workerd's local D1 (glibc only) |
| `bun run deploy` | Build and deploy to Cloudflare |

Local secrets go in `.dev.vars` (copy `.dev.vars.example`). They hold Cloudflare's Turnstile test keys and the admin password.

**musl Linux (e.g. Chimera):** Cloudflare's local runtime (`workerd`) needs glibc. On musl, `astro dev` detects this,
runs without the Cloudflare adapter and swaps `cloudflare:workers` for `src/dev/workers-local.ts`, a stand-in that keeps
D1 in a SQLite file (`.wrangler/local/d1.sqlite`) and applies `migrations/` itself. Turnstile still uses the test keys,
so the guestbook needs internet access in dev. Builds and deploys always use the real Cloudflare adapter;
`astro preview` needs workerd and won't run on musl.

## First deploy

1. `bunx wrangler login`
2. `bunx wrangler d1 create nicoportfolio`, then put the printed `database_id` in `wrangler.jsonc`.
3. `bunx wrangler d1 migrations apply DB --remote`
4. Create a Turnstile widget for `nico.kodeko.org` in the Cloudflare dashboard. Put its site key in `wrangler.jsonc`
   (`TURNSTILE_SITE_KEY`) and set the secret: `bunx wrangler secret put TURNSTILE_SECRET_KEY`.
5. `bunx wrangler secret put ADMIN_PASSWORD`
6. `bun run deploy`, then add the custom domain `nico.kodeko.org` to the Worker.

## Guestbook moderation

Go to `/admin/`. The browser asks for a password: any username works, and the password is `ADMIN_PASSWORD`.
New drawings wait there until approved. "Take down" hides an approved drawing again, and "Delete" removes it for good.
Submissions stop being accepted while 200 drawings are waiting.

## Decorations

- `src/assets/decor/doodles.webp` is the wallpaper tile, made from small bits of his drawings (signatures, the kitty,
  sparkles, the jester hat). `hoodie-dog.png` is the hoodie dog cut out of one drawing. Swap either for a better version anytime.
- Each page picks its wallpaper with `<Base ground="...">`: `doodles`, `wires`, `sky`, `sparkle` or `none` (see `global.css`).
- Found stickers live in `src/assets/stickers/`. They're credited in the footer.
- The penguin on `/fun/` plays `public/sounds/hello.ogg`.
- `public/decor/dark-fountain.gif` (and its still frame) is DELTARUNE's Dark Fountain, from the DEVICE menu, shrunk to 320×240.
