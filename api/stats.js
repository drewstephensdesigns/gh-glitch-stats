// api/stats.js
// Retro/pixel/glitch GitHub stats card, rendered server-side as SVG.
// Usage:
//   /api/stats?repo=owner/name     -> single repo card
//   /api/stats?user=someusername   -> aggregate profile card
// Optional:
//   &theme=crt | matrix | vapor | gameboy | blueprint | terminal      (default: crt)
//   &glitch=0  (disable jitter/RGB-split animation)

const API_VERSION = "2026-03-10";
const GH_API = "https://api.github.com";

const THEMES = {
  crt: {
    bg: "#0b0f0a",
    grid: "#132314",
    fg: "#e8ffe8",
    primary: "#39ff14",
    accentA: "#ff2079",
    accentB: "#00fff9",
    dim: "#5f8f5f",
    label: "#9fd9a0",
    scanline: "#000000",
  },
  matrix: {
    bg: "#000000",
    grid: "#031a03",
    fg: "#baffc9",
    primary: "#00ff41",
    accentA: "#00b32d",
    accentB: "#7CFC9A",
    dim: "#0f5f24",
    label: "#4ddb7a",
    scanline: "#000000",
  },
  vapor: {
    bg: "#1a0b2e",
    grid: "#2a1550",
    fg: "#fffb96",
    primary: "#ff71ce",
    accentA: "#01cdfe",
    accentB: "#b967ff",
    dim: "#7a5ea8",
    label: "#c9b8ff",
    scanline: "#0a0416",
  },
  gameboy: {
    bg: "#0f380f",
    grid: "#144414",
    fg: "#9bbc0f",
    primary: "#8bac0f",
    accentA: "#306230",
    accentB: "#9bbc0f",
    dim: "#306230",
    label: "#c4e08b",
    scanline: "#0f380f",
  },
  blueprint: {
    bg: "#001133",
    grid: "#0a2a5c",
    fg: "#dceeff",
    primary: "#33ccff",
    accentA: "#ff6b6b",
    accentB: "#7fd8ff",
    dim: "#3d6ea8",
    label: "#8fc4e8",
    scanline: "#001133",
  },
  terminal: {
    chrome: "window",
    bg: "#1e1e1e",
    titlebar: "#323233",
    fg: "#d4d4d4",
    primary: "#4ec9b0",
    accentA: "#569cd6",
    accentB: "#dcdcaa",
    dim: "#6a6a6a",
    label: "#9cdcf3",
    dots: ["#ff5f56", "#ffbd2e", "#27c93f"]
  }
};

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n) {
  if (n === undefined || n === null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

const AUTHOR_USERNAME = "drewstephensdesigns";

// Octicon "mark-github" path, drawn inline so no external asset/font is needed.
const GITHUB_ICON_PATH =
    "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";

// Renders the GitHub-mark + username, right-aligned so it works at any width.
function githubCredit(rightX, y, color) {
  const size = 12;
  const textWidth = AUTHOR_USERNAME.length * 6.5 + 8; // monospace char-width estimate
  const iconX = rightX - textWidth - size - 4;
  return `
      <g transform="translate(${iconX}, ${y - size + 2}) scale(${size / 16})">
        <path fill="${color}" fill-rule="evenodd" d="${GITHUB_ICON_PATH}"/>
      </g>
      <text x="${iconX + size + 4}" y="${y}" font-family="'Courier New', monospace" font-size="11" fill="${color}">@${esc(
      AUTHOR_USERNAME
  )}</text>`;
}

async function ghFetch(path) {
  const headers = {
    "User-Agent": "gh-glitch-stats",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const res = await fetch(`${GH_API}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function getRepoStats(fullName) {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) throw new Error("repo must be in owner/name format");
  const data = await ghFetch(`/repos/${owner}/${repo}`);
  return {
    title: data.full_name,
    rows: [
      ["stars", fmt(data.stargazers_count)],
      ["forks", fmt(data.forks_count)],
      ["issues", fmt(data.open_issues_count)],
      ["watchers", fmt(data.subscribers_count ?? data.watchers_count)],
    ],
    tag: data.language || "n/a",
  };
}

async function getUserStats(username) {
  const user = await ghFetch(`/users/${username}`);
  let page = 1;
  let repos = [];
  // Cap at 3 pages (300 repos) to keep function fast/within rate limits.
  while (page <= 3) {
    const batch = await ghFetch(
      `/users/${username}/repos?per_page=100&page=${page}&type=owner&sort=updated`
    );
    repos = repos.concat(batch);
    if (batch.length < 100) break;
    page += 1;
  }
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
  const langCount = {};
  for (const r of repos) {
    if (r.language) langCount[r.language] = (langCount[r.language] || 0) + 1;
  }
  const topLang = Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "n/a";

  return {
    title: user.login,
    rows: [
      ["repos", fmt(user.public_repos)],
      ["stars", fmt(totalStars)],
      ["forks", fmt(totalForks)],
      ["followers", fmt(user.followers)],
    ],
    tag: topLang,
  };
}

function renderTerminalWindow({ title, rows, tag}, t) {
  const W = 480;
  const H = 210;
  const barH = 28;
  const rowH = 24;
  const rowsStartY = barH + 72;
  const r = 10;

  const dotsRow = t.dots
      .map((c, i) => `<circle cx="${20 + i * 18}" cy="${barH / 2}" r="6" fill="${c}"/>`)
      .join("");

  const rowEls = rows
      .map(([label, value], i) => {
        const y = rowsStartY + i * rowH;
        return `
      <text x="28" y="${y}" font-family="'Courier New', monospace" font-size="14" fill="${t.label}">&gt; ${esc(
            label
        )}</text>
      <text x="220" y="${y}" font-family="'Courier New', monospace" font-weight="700" font-size="14" fill="${t.primary}">${esc(
            value
        )}</text>`;
      })
      .join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(
      title
  )} stats">
  <defs>
    <clipPath id="winclip">
      <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" ry="${r}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#winclip)">
    <rect x="0" y="0" width="${W}" height="${H}" fill="${t.bg}"/>
    <rect x="0" y="0" width="${W}" height="${barH}" fill="${t.titlebar}"/>
    ${dotsRow}
    <text x="${W / 2}" y="${barH / 2 + 4}" text-anchor="middle" font-family="'Courier New', monospace" font-size="12" fill="${t.dim}">${esc(
      title
  )} &#8212; zsh</text>
    <line x1="0" y1="${barH}" x2="${W}" y2="${barH}" stroke="#000000" stroke-opacity="0.3" stroke-width="1"/>
 
    <text x="${W - 20}" y="${barH + 24}" text-anchor="end" font-family="'Courier New', monospace" font-size="12" letter-spacing="1" fill="${t.accentA}">[${esc(
      tag
  )}]</text>
    <text x="24" y="${barH + 30}" font-family="'Courier New', monospace" font-weight="700" font-size="20" fill="${t.fg}">${esc(
      title
  )}</text>
    <line x1="24" y1="${barH + 40}" x2="${W - 24}" y2="${barH + 40}" stroke="${t.dim}" stroke-width="1" stroke-dasharray="4 3"/>
    ${rowEls}
    <text x="28" y="${H - 14}" font-family="'Courier New', monospace" font-size="11" fill="${t.dim}">$ generated_by gh-glitch-stats<tspan fill="${t.primary}">_</tspan></text>
    ${githubCredit(W - 20, H - 14, t.dim)}
  </g>
  <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" ry="${r}" fill="none" stroke="#000000" stroke-opacity="0.5" stroke-width="1"/>
</svg>`;
}

function renderSVG({ title, rows, tag }, themeName, glitchOn) {
  const t = THEMES[themeName] || THEMES.crt;

  if (t.chrome === "window"){
    return renderTerminalWindow({ title, rows, tag}, t);
  }

  const W = 480;
  const H = 200;
  const rowH = 24;
  const rowsStartY = 92;

  // Pixel-grid background: small squares tiled via <pattern>.
  const gridPattern = `
    <pattern id="pxgrid" width="10" height="10" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="${t.bg}"/>
      <rect width="9" height="9" fill="${t.grid}"/>
    </pattern>`;

  // CRT scanlines overlay.
  const scanPattern = `
    <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="transparent"/>
      <rect width="4" height="1" fill="${t.scanline}" opacity="0.35"/>
    </pattern>`;

  // Pixelated stepped border (8-bit corner notches).
  const notch = 6;
  const corners = [
    [0, 0],
    [W - notch, 0],
    [0, H - notch],
    [W - notch, H - notch],
  ];
  const cornerRects = corners
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="${notch}" height="${notch}" fill="${t.primary}"/>`)
    .join("");

  // Glitch title: RGB-split layered text with discrete jitter animation.
  const titleY = 46;
  const glitchAnim = (dx, dur, dyVals) => `
      <animate attributeName="dx" values="${dx}" dur="${dur}" repeatCount="indefinite" calcMode="discrete"/>
      <animate attributeName="dy" values="${dyVals}" dur="${dur}" repeatCount="indefinite" calcMode="discrete"/>`;

  const titleLayers = glitchOn
    ? `
    <text x="24" y="${titleY}" font-family="'Courier New', monospace" font-weight="700" font-size="22"
          letter-spacing="2" fill="${t.accentA}" opacity="0.75">
      ${esc(title)}
      ${glitchAnim("0;2;-2;0;1;0", "2.4s", "0;-1;1;0;0;0")}
    </text>
    <text x="24" y="${titleY}" font-family="'Courier New', monospace" font-weight="700" font-size="22"
          letter-spacing="2" fill="${t.accentB}" opacity="0.75">
      ${esc(title)}
      ${glitchAnim("0;-2;2;0;-1;0", "2.9s", "0;1;-1;0;0;0")}
    </text>
    <text x="24" y="${titleY}" font-family="'Courier New', monospace" font-weight="700" font-size="22"
          letter-spacing="2" fill="${t.fg}">
      ${esc(title)}
    </text>`
    : `<text x="24" y="${titleY}" font-family="'Courier New', monospace" font-weight="700" font-size="22"
          letter-spacing="2" fill="${t.fg}">${esc(title)}</text>`;

  // Stat rows.
  const rowEls = rows
    .map(([label, value], i) => {
      const y = rowsStartY + i * rowH;
      return `
      <text x="28" y="${y}" font-family="'Courier New', monospace" font-size="14" fill="${t.label}">&gt; ${esc(
        label
      )}</text>
      <text x="220" y="${y}" font-family="'Courier New', monospace" font-weight="700" font-size="14" fill="${t.primary}">${esc(
        value
      )}</text>`;
    })
    .join("");

  const cursorBlink = glitchOn
    ? `<animate attributeName="opacity" values="1;1;0;0" dur="1s" repeatCount="indefinite"/>`
    : "";

  const tagY = 24;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(
      title
  )} stats">
  <defs>
    ${gridPattern}
    ${scanPattern}
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#pxgrid)"/>
  <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${t.primary}" stroke-width="2"/>
  ${cornerRects}
  <text x="${W - 20}" y="${tagY}" text-anchor="end" font-family="'Courier New', monospace" font-size="12" letter-spacing="1" fill="${t.accentB}">[${esc(
      tag
  )}]</text>
  ${titleLayers}
  <line x1="24" y1="60" x2="${W - 24}" y2="60" stroke="${t.dim}" stroke-width="1" stroke-dasharray="4 3"/>
  ${rowEls}
  <text x="28" y="${H - 14}" font-family="'Courier New', monospace" font-size="11" fill="${t.dim}">$ generated_by gh-glitch-stats<tspan fill="${t.primary}">_</tspan></text>
  ${githubCredit(W - 20, H - 14, t.dim)}
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#scanlines)"/>
</svg>`;
}

module.exports = async (req, res) => {
  try {
    const { repo, user, theme, glitch } = req.query || {};
    const themeName = (theme || "crt").toLowerCase();
    const glitchOn = glitch !== "0";

    let stats;
    if (repo) {
      stats = await getRepoStats(String(repo));
    } else if (user) {
      stats = await getUserStats(String(user));
    } else {
      throw new Error("pass ?repo=owner/name or ?user=username");
    }

    const svg = renderSVG(stats, THEMES[themeName] ? themeName : "crt", glitchOn);

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600"
    );
    res.status(200).send(svg);
  } catch (err) {
    const msg = err && err.message ? err.message : "unknown error";
    const errSvg = `<svg width="480" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect width="480" height="120" fill="#0b0f0a"/>
      <text x="20" y="40" font-family="'Courier New', monospace" font-size="14" fill="#ff2079">[error]</text>
      <text x="20" y="66" font-family="'Courier New', monospace" font-size="12" fill="#e8ffe8">${esc(
        msg
      ).slice(0, 60)}</text>
    </svg>`;
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.status(200).send(errSvg);
  }
};
