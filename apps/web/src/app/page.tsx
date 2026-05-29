import Link from 'next/link';

const STACK = [
  'Manifest V3',
  'TypeScript (strict)',
  'React 18',
  'Vite + @crxjs/vite-plugin',
  'Tailwind CSS',
  'Vitest',
];

const LAYERS = [
  {
    title: 'Page scan',
    body: "Content script reads the active tab's mailto links, anchors, footer text, visible body, meta tags, and JSON-LD ContactPoint blocks.",
  },
  {
    title: 'Same-domain probe',
    body: 'Background service worker GETs up to six conventional paths (/support, /contact, /help, /customer-service…) on the current origin with a 2.5s timeout.',
  },
  {
    title: 'Structured hints',
    body: 'schema.org/ContactPoint entries are extracted from JSON-LD and weighted higher in scoring.',
  },
  {
    title: 'Confidence ranking',
    body: 'Additive scoring across type, footer position, URL path hints, keyword matches, probe reachability, and email local-part heuristics.',
  },
];

const NON_GOALS = [
  'Guessing random emails',
  'Bypassing authentication or scraping private data',
  "Sending messages on the user's behalf",
  'Promising perfect accuracy on every website',
  'Running an enterprise-grade crawler',
];

const FILES = [
  'manifest.json — Manifest V3 declaration',
  'src/background/ — service worker (coordination + cache)',
  'src/content/ — DOM scanner injected into pages',
  'src/popup/ — React popup UI',
  'src/lib/discovery.ts — pipeline + probing',
  'src/lib/scoring.ts — deterministic confidence scoring',
  'src/lib/email.ts — extraction + safety filters',
  'src/lib/cache.ts — chrome.storage.local TTL cache',
];

export default function Page() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex flex-col gap-3 mb-12">
          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 rounded-full px-3 py-1 text-xs font-medium self-start">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            Chrome Extension · Source delivery
          </span>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
            Support Finder
          </h1>
          <p className="text-base text-gray-500 max-w-xl">
            A Chrome extension that finds the best public support contact for the website
            you&apos;re visiting — email, contact form, help center, or live chat. Built as a
            best-effort discovery tool, not a magic email finder.
          </p>
        </div>

        <Section title="How it works" subtitle="Four deterministic layers — no AI invention.">
          <div className="grid md:grid-cols-2 gap-4">
            {LAYERS.map((l) => (
              <div
                key={l.title}
                className="rounded-xl border border-gray-200 p-5 bg-white flex flex-col gap-1"
              >
                <div className="text-base font-semibold text-gray-900">{l.title}</div>
                <div className="text-sm text-gray-500">{l.body}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tech stack">
          <div className="flex flex-wrap gap-2">
            {STACK.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1 text-xs font-medium text-gray-700"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                {s}
              </span>
            ))}
          </div>
        </Section>

        <Section
          title="Install in Chrome"
          subtitle="The source lives in /apps/extension/. Build it locally, then load the dist directory as an unpacked extension."
        >
          <div className="rounded-xl border border-gray-200 bg-[#F9FAFB] p-5 font-mono text-sm text-gray-700 leading-relaxed">
            <div>
              <span className="text-gray-400 mr-2">-</span>
              cd apps/extension
            </div>
            <div>
              <span className="text-gray-400 mr-2">-</span>
              yarn install
            </div>
            <div>
              <span className="text-gray-400 mr-2">-</span>
              yarn build
            </div>
            <div className="mt-3 text-gray-500 font-sans">Then in Chrome:</div>
            <div>
              <span className="text-gray-400 mr-2">-</span>
              Visit chrome://extensions
            </div>
            <div>
              <span className="text-gray-400 mr-2">-</span>
              Toggle Developer mode
            </div>
            <div>
              <span className="text-gray-400 mr-2">-</span>
              Click &quot;Load unpacked&quot; → select apps/extension/dist
            </div>
          </div>
        </Section>

        <Section title="Source layout">
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-1">
            {FILES.map((f) => (
              <div key={f} className="text-sm text-gray-600 py-1">
                <span className="text-gray-400 mr-2">-</span>
                {f}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Non-goals" subtitle="What this extension explicitly will not do.">
          <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col gap-1">
            {NON_GOALS.map((n) => (
              <div key={n} className="text-sm text-gray-600 py-1">
                <span className="text-gray-400 mr-2">-</span>
                {n}
              </div>
            ))}
          </div>
        </Section>

        <div className="mt-16 pt-6 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">
            Read the full detection logic in the extension README.
          </span>
          <Link
            href="/"
            className="text-xs font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded px-1"
          >
            apps/extension/README.md
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
