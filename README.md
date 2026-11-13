# mrnico12

Portfolio of Nicolas (mrnico12): a gallery of drawings, an about page, contact links and a drawing guestbook.
Built with Astro. Everything is prerendered except the guestbook and the visitor counter, which use a small SQLite
database. It runs as a plain Node server (your own machine, a VPS, anything that runs Node) or on Vercel.

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
2. **Build from Git on Vercel.** See [Hosting on Vercel](#hosting-on-vercel).
3. **The secret.** In the Vercel project: *Settings* → *Environment Variables* → add `DRAWINGS_TOKEN` with the token
   from step 1.
4. **Deploy hook.** *Settings* → *Git* → *Deploy Hooks* → create one for branch `main` and copy the URL.
5. **In the drawings repo.** *Settings* → *Secrets and variables* → *Actions* → new repository secret
   `SITE_DEPLOY_HOOK` with that URL.

The workflow lives in his repo as `.github/workflows/rebuild-site.yml`. Every push to his `main` (except one that only
touches the README) pings the hook and Vercel rebuilds the site, which takes a couple of minutes. It can also be run
by hand from the *Actions* tab. Without the secret the run fails with a message saying so. On your own server there is
no hook: run `bun run build` again and restart it.

## Commands

| Command | What it does |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Dev server at `localhost:4321` |
| `bun run build` | Build to `dist/` (or to `.vercel/output/` on Vercel) |
| `bun run start` | Run the built site with Node at `localhost:4321` |

## Settings

Copy `.env.example` to `.env`. `bun run dev`, `bun run build` and `bun run start` read it; on Vercel the same names go
in the project's environment variables. `SITE` and the `DRAWINGS_*` settings above are used by the build. The rest are
read when the server runs, so changing one needs a restart, not a rebuild.

| Setting | What it does |
| --- | --- |
| `ADMIN_PASSWORD` | Password for `/admin/`. Without it nobody can get in. |
| `DATABASE_PATH` | Where the SQLite file goes (default `data/guestbook.sqlite`). |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Use a [Turso](https://turso.tech) database instead of a file. Needed on Vercel. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Optional robot check on the guestbook (Cloudflare Turnstile, free, works on any host). Off unless both are set. |
| `SITE` | The site's address when it isn't `https://nico.kodeko.org`. Vercel fills it in by itself. |

The database (see `src/lib/db.ts`) creates its own tables from `migrations/` the first time it is used, on a file and
on Turso alike. Without Turnstile the guestbook still has a honeypot field, the moderation queue and its 200-drawing
limit, but nothing stops a script from filling that queue.

## Hosting it yourself

```sh
bun install
bun run build
bun run start
```

That serves the site at `http://localhost:4321` with Node (22 or newer). The guestbook lives in
`data/guestbook.sqlite`, so that file is the one to back up.

- `HOST=0.0.0.0` makes it reachable from other machines, and `PORT` changes the port.
- **Another address than nico.kodeko.org** (a different domain, or a LAN address like `http://192.168.1.42:4321`):
  build with `SITE=https://your.domain bun run build`. Besides `localhost`, the server only accepts guestbook and
  admin submissions that come from that address.
- **Behind a reverse proxy** (Caddy, nginx), the proxy has to pass the original `Host` header and
  `X-Forwarded-Proto`. Caddy does both by itself; nginx needs `proxy_set_header Host $host;` and
  `proxy_set_header X-Forwarded-Proto $scheme;`.

## Hosting on Vercel

The build notices Vercel by itself and switches adapter; there is nothing to configure in the repo.

1. Push this project to its own GitHub repo and import it at vercel.com/new. The defaults are right.
2. Vercel has no disk to keep a SQLite file on, so make a free database at [turso.tech](https://turso.tech) (or
   `turso db create nicoportfolio`). Copy its URL (`turso db show --url nicoportfolio`) and a token
   (`turso db tokens create nicoportfolio`).
3. In the Vercel project, *Settings* → *Environment Variables*: add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and
   `ADMIN_PASSWORD` (plus the Turnstile pair and `DRAWINGS_TOKEN` if you use them).
4. Redeploy so the variables take effect, then add the domain under *Settings* → *Domains*. Links and the sitemap
   follow the project's production domain.

Until the Turso variables are there, the guestbook and the visitor counter answer with an error; the rest of the site
works.

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
