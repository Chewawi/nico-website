# mrnico12

Portfolio of Nicolas (mrnico12): a gallery of drawings, an about page, contact links and a drawing guestbook.
Built with Astro and deployed to Cloudflare Workers. Everything is prerendered except the guestbook, which uses Cloudflare D1.

## The drawings

The gallery comes from Nico's repo, [MrDino127/drawings](https://github.com/MrDino127/drawings). Every build clones it
into `.drawings/` (ignored by git) and shows every PNG, JPG, WebP, GIF or AVIF in it. See `src/lib/drawings.ts`.

His repo's README explains the layout to him. In short:

- **One folder per category.** The folder name is the filter chip (chips are alphabetical). Pictures outside any folder
  go under "drawings"; an empty folder, or one where everything is hidden, gets no chip.
- **An optional `.txt` next to each drawing**, same name: `fan art/Ralsei.gif` → `fan art/Ralsei.txt`. One
  `key: value` per line: `title`, `alt`, `featured: yes`, `hidden: yes`. A bare `featured` or `hidden` line also
  means yes, `#` starts a comment, and the match is case-insensitive. Lines it doesn't understand, and .txt files with
  no drawing, only log a warning, so a typo never breaks the build.
- **Order: newest first**, by when the file was first added to the repo. Moves and renames keep their date (exact
  renames are followed in `git log`, which needs no blob downloads), and ties go alphabetically by title. Outside a git
  checkout everything ties.
- Names starting with `_` or `.` (files or folders), and anything with "DO NOT REPOST" in the name, never show up.
- Drawing ids (the `#hash` in shared links) come from the filename only, so moving a drawing between folders keeps its
  links working.

| Setting | What it does |
| --- | --- |
| `DRAWINGS_TOKEN` | GitHub token for a private repo (read-only). Only needed when the repo is private. |
| `DRAWINGS_DIR` | Use a local clone instead of downloading, e.g. `DRAWINGS_DIR=../drawings bun run dev`. Edits show up live. |
| `DRAWINGS_REPO`, `DRAWINGS_BRANCH` | Another repo or branch (default `MrDino127/drawings`, `main`). |

If the download fails the build fails too, so the live site keeps the last good version.

### Rebuilding when he pushes

1. **Token (only if the drawings repo is private).** Nico, signed in as MrDino127, makes a fine-grained token at
   github.com/settings/personal-access-tokens/new: *Repository access* → *Only select repositories* → `drawings`;
   *Permissions* → *Contents: Read-only* (nothing else). It has to be his account, because fine-grained tokens only
   reach repos owned by the account that makes them.
2. **Build from Git on Cloudflare.** Push this project to its own GitHub repo, then in the Cloudflare dashboard go to
   *Workers & Pages* → `nicoportfolio` → *Settings* → *Builds* → *Connect* and pick it. Build command `bun run build`,
   deploy command `npx wrangler deploy`.
3. **The secret.** Same page → *Variables and secrets* (the build ones, not the runtime ones) → add `DRAWINGS_TOKEN`
   as a *Secret* with the token from step 1.
4. **Deploy hook.** Same page → *Deploy Hooks* → create one for branch `main` and copy the URL.
5. **In the drawings repo.** *Settings* → *Secrets and variables* → *Actions* → new repository secret
   `SITE_DEPLOY_HOOK` with that URL.

The workflow lives in his repo as `.github/workflows/rebuild-site.yml`. Every push to his `main` (except one that only
touches the README) pings the hook and Cloudflare rebuilds the site, which takes a couple of minutes. It can also be run
by hand from the *Actions* tab. Without the secret the run fails with a message saying so.

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

- Each page picks its background with `<Base ground="...">`: `plain` (grain and halftone), `wires`, `sky`, `sparkle`
  or `none` (see `global.css`). The home page fades his pole photo in behind the top, like the straw page did, and puts
  the drawings on a torn sheet.
- Found stickers live in `src/assets/stickers/`. They're credited in the footer.
- The penguin on `/fun/` plays `public/sounds/hello.ogg`.
- `public/decor/dark-fountain.mp4` is DELTARUNE's Dark Fountain with the green keyed out, stored as "stacked alpha"
  (picture on top, transparency below) so one H.264 file works everywhere, Safari included; `src/scripts/fountain.ts`
  puts it back together with WebGL. The ffmpeg script that made it from the green-screen original is in git history
  (`git show fba8f95:scripts/fountain.sh`).
- `public/decor/niko.gif` is a found Niko (OneShot) emoji.
- Rain World: typing `rain` sends a slugcat to shelter on one of the papers, where it curls up asleep (now and then one
  is already there). Clicking it wakes it, and a karma symbol rises where it slept. `public/decor/slugcat.gif` is the
  wiki's `Remix_Tips_Sleep.gif` cut to play once and end asleep, `slugcat-still.png` is that last frame for reduced
  motion, and `karma.png` is `Karma_5_icon.png`, both from the [Rain World Wiki](https://rainworld.miraheze.org).
