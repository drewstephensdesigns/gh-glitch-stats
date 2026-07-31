# GitHub Glitch Stats Card

Retro, pixelated, glitchy GitHub stats cards for your `README.md` — rendered live
as SVG by a tiny serverless function on top of the [GitHub REST Repos API](https://docs.github.com/en/rest/repos?apiVersion=2026-03-10).

<p align="center">
  <img src="https://gh-glitch-stats.vercel.app/api/stats?user=drewstephensdesigns&theme=crt" alt="repo stats card" />
</p>

No client-side JS ships in the badge itself — GitHub renders it as a plain
`<img>`, and the SVG's own `<animate>`/CSS carries the CRT scanlines and
RGB-split glitch text.

## Live demo

Deploy the `public/index.html` page (via Vercel or GitHub Pages) to get an
interactive generator with theme switching and copy-paste markdown. See
**Deploying** below — the demo page needs the API to live somewhere reachable;
Vercel hosts both in one shot, GitHub Pages only serves the static page and
must point at a Vercel-hosted API.

## Usage

Once deployed, embed a card with a plain markdown image:

```md
![stats](https://YOUR-DEPLOYMENT.vercel.app/api/stats?repo=owner/name&theme=crt)
```

### Modes

| Param | Example | Description |
|---|---|---|
| `repo` | `?repo=octocat/Hello-World` | Stars, forks, open issues, watchers for one repo |
| `user` | `?user=octocat` | Aggregated repo count, total stars, total forks, followers, top language |

### Options

| Param | Values | Default |
|---|---|---|
| `theme` | `crt`, `matrix`, `vapor`, `gameboy`, `blueprint` | `crt` |
| `glitch` | `1`, `0` | `1` (set to `0` for a static, non-animated card) |

## Themes
<p align="center">
  <img src="https://gh-glitch-stats.vercel.app/api/stats?repo=octocat/Hello-World&theme=crt" width="220" alt="crt theme" />
  <img src="https://gh-glitch-stats.vercel.app/api/stats?repo=octocat/Hello-World&theme=matrix" width="220" alt="matrix theme" />
  <img src="https://gh-glitch-stats.vercel.app/api/stats?repo=octocat/Hello-World&theme=vapor" width="220" alt="vaporwave theme" />
  <img src="https://gh-glitch-stats.vercel.app/api/stats?repo=octocat/Hello-World&theme=gameboy" width="220" alt="gameboy theme" />
  <img src="https://gh-glitch-stats.vercel.app/api/stats?repo=octocat/Hello-World&theme=blueprint" width="220" alt="blueprint theme" />
</p>

## Deploying

### Vercel (recommended — hosts API + demo page together)

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Optional: add a `GITHUB_TOKEN` environment variable (a fine-grained PAT with
   no extra scopes is enough) to raise the GitHub API rate limit from 60/hr to
   5,000/hr — recommended if you're on a `user` aggregate card, which makes
   several requests per render.
4. Deploy. Your card is live at `https://<project>.vercel.app/api/stats?...`.

### GitHub Pages (static demo page only)

GitHub Pages can't run the serverless function, only static files. If you want
the interactive demo on Pages:

1. Deploy the API on Vercel first (steps above).
2. Publish `public/index.html` to Pages (e.g. via a `gh-pages` branch or the
   Pages build action).
3. In `public/index.html`, change the relative `/api/stats` URLs to your full
   Vercel URL.

## Local development

```bash
npm i -g vercel
vercel dev
```

Then visit `http://localhost:3000` for the demo page and
`http://localhost:3000/api/stats?repo=owner/name` for a raw card.

## How it works

`api/stats.js` calls the GitHub REST API (`GET /repos/{owner}/{repo}` or
`GET /users/{username}/repos`), builds a small SVG by hand (pixel-grid `<pattern>`
background, a scanline overlay `<pattern>`, stepped-corner border, and three
overlapping `<text>` layers with offset `<animate>` timings for the RGB-split
glitch on the title), and returns it with `Content-Type: image/svg+xml` and a
30-minute cache header so repeat README views don't hammer your rate limit.

## License

MIT
