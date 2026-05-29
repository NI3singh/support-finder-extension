# Support Finder — Chrome Extension

A Chrome extension that helps you contact the support team of the website
you're currently visiting, with the least possible navigation. It detects
the active tab, scans for support signals, probes the most likely public
support routes on the same domain, and ranks the results by confidence.

> **Honest framing.** This is a **best-effort public support discovery
> tool**, not a magical universal email finder. If a site doesn't expose
> public support information, the extension will say so clearly rather
> than fabricate a result.

---

## What it finds

- Support / contact emails (`support@…`, `help@…`, etc.)
- Contact forms and "Contact us" pages
- Help center / FAQ pages
- Customer service / ticket pages
- Live chat entry points (when publicly visible)

For each result you get:

- A **type label** (Email, Contact Form, Help Center, Live Chat, Support Page)
- A **confidence score** (0–100)
- A short **explanation** of why it was ranked
- A one-tap action: **Open**, **Copy email**, or **Copy link**
- An optional **draft message** template you can copy/paste

---

## How discovery works

A four-layer deterministic pipeline. AI is **not** used to invent
contacts — only deterministic heuristics decide what's surfaced.

### Layer 1 — Current-page scan (content script)

The content script reads only **publicly-visible** content from the
active tab:

- `mailto:` links
- All anchor links + their visible text
- The page footer (largest `<footer>`, `[role=contentinfo]`, or
  `*[class*=footer]` element)
- Visible body text (`innerText`, truncated)
- `<title>` and `<meta name="description">`
- JSON-LD `schema.org/ContactPoint` blocks

### Layer 2 — Same-domain probing (service worker)

If the page-scan doesn't yield a strong result, the background service
worker probes a small set of conventional paths on the **same origin**:

```
/support  /contact  /contact-us  /help  /help-center
/customer-service  /faq  /report  /feedback  /billing  /refund  /returns
```

Each probe is a single GET with a 2.5s timeout, limited to 6 concurrent
requests. The HTML title and a small body sample are parsed to confirm
the page is support-related.

### Layer 3 — Structured hints

`schema.org/ContactPoint` entries from JSON-LD are extracted directly:
their `email`, `url`, and `contactType` feed into the candidate pool
with a structured-data boost.

### Layer 4 — Confidence scoring

Each candidate is scored from a small set of additive signals:

| Signal | Weight |
|---|---|
| Base score by type | 0.10–0.35 |
| Schema.org ContactPoint | +0.25 |
| Found in page footer | +0.10 |
| Same registrable domain | +0.10 |
| URL path hint (`/support`, `/contact`…) | +0.10–0.35 |
| Strong link-text keyword | +0.15 |
| Probe returned 200 OK | +0.05 |
| Probe content matched support keywords | +0.10 |
| Email local-part is `support`/`help`/etc. | up to +0.30 |

The score is clamped to `[0, 1]`. The top candidate is shown as **Best**;
up to five alternatives are listed below.

### Safety filters

- `noreply@`, `do-not-reply@`, `test@`, `example.com`, asset-looking
  strings, etc. are **always rejected**.
- Cross-origin probes are never attempted.
- The extension only inspects the active tab the user already has open.

---

## Install (development)

```bash
cd apps/extension
yarn install        # or npm install / pnpm install
yarn build          # produces ./dist
```

Then in Chrome:

1. Visit `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the `apps/extension/dist` directory

The extension icon will appear in the toolbar. Open any website and
click the icon to scan.

> Before publishing, drop real icons into `apps/extension/icons/`
> (see `icons/README.md`).

### Scripts

```bash
yarn dev          # watch-mode build (rebuilds on file change)
yarn build        # production build
yarn type-check   # tsc --noEmit
yarn test         # vitest run
```

---

## Project structure

```
apps/extension/
├── manifest.json              # MV3 manifest
├── popup.html                 # popup entry HTML
├── vite.config.ts             # @crxjs/vite-plugin build
├── src/
│   ├── background/index.ts    # service worker (coordination + cache)
│   ├── content/index.ts       # DOM scanner injected into pages
│   ├── popup/                 # React popup UI
│   │   ├── index.tsx
│   │   ├── Popup.tsx
│   │   └── components/
│   ├── lib/                   # discovery engine
│   │   ├── discovery.ts       # pipeline + probing
│   │   ├── scoring.ts         # confidence scoring
│   │   ├── email.ts           # email extraction + filtering
│   │   ├── keywords.ts        # keyword + path dictionaries
│   │   ├── cache.ts           # chrome.storage.local TTL cache
│   │   └── draft.ts           # message-draft template
│   └── types/index.ts         # shared types
└── icons/                     # 16/32/48/128 px icons (add your own)
```

---

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the URL/title of the tab the user explicitly opens the popup on. |
| `storage` | Cache discovery results per-origin for 24h to avoid re-scanning. |
| `scripting` | Reserved for future on-demand injection (the manifest currently uses a declared content script). |
| `host_permissions: <all_urls>` | Required for the background worker to probe `/support`, `/contact`, etc. on the active site's same origin. |

We never collect or transmit user data. There is no backend.

---

## Caching

Results are cached in `chrome.storage.local` keyed by **origin**, with a
24-hour TTL. The popup shows a small `cached` pill when a cached result
is rendered. Click **Refresh** to invalidate the cache and re-scan.

---

## Acceptance criteria

- ✅ Loads in Chrome without errors (MV3, no deprecated APIs).
- ✅ Popup inspects the current tab via `chrome.tabs.query`.
- ✅ Discovers at least one support route on standard sites with
  public contact info.
- ✅ Results are ranked by the deterministic scoring described above.
- ✅ Simple, dense UI with `Open` / `Copy` actions and a draft generator.
- ✅ No fabricated emails — every result is grounded in actual extracted
  text or a successful HTTP probe.
- ✅ Minimal permissions; no telemetry; no backend.

---

## What is uncertain / explicitly out of scope

- **Single-page apps** that hide their support routes behind in-app
  routing may produce weaker results — we scan the rendered DOM at
  `document_idle`, so dynamically-mounted footers are usually included,
  but heavy client-only navigation may not be.
- **JavaScript-heavy probe targets** (e.g. `/support` that's a
  shell-only SPA) won't yield title/body content from a single GET; the
  page still appears as a candidate but scores lower without
  support-content confirmation.
- **Non-English sites**: we ship a small list of common non-English
  keywords (`kontakt`, `soporte`, `お問い合わせ`…) but coverage is partial.
- **Generic contact forms** that are actually sales/PR can't always be
  distinguished from real support — we use URL hints to deprioritize
  `/sales` / `/press` / `/demo`, but mistakes are possible.
- **Some sites' help centers live on third-party domains** (e.g.
  `help.shopify.com` linked from a Shopify store). We surface these as
  candidates with a `sameDomain: false` flag, which reduces their score
  but still keeps them in the list.

When confidence is genuinely low, the popup labels the result
accordingly. When nothing reliable exists, it shows a neutral empty
state — **never** a fabricated address.

---

## License

MIT — see `LICENSE` (add your own when shipping).
