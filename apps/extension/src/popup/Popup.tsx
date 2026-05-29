import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiscoveryResult, PopupRequest, PopupResponse, SupportCandidate } from '@/types';
import { buildDraft } from '@/lib/draft';
import { CandidateRow } from './components/CandidateRow';
import { TypePill } from './components/TypePill';
import { ConfidenceRing } from './components/ConfidenceRing';
import { EmptyState } from './components/EmptyState';
import { LoadingState } from './components/LoadingState';
import { ErrorState } from './components/ErrorState';

type View = 'results' | 'draft';

export function Popup() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [pageUrl, setPageUrl] = useState<string>('');
  const [view, setView] = useState<View>('results');
  const [draftCopied, setDraftCopied] = useState(false);

  const runDiscovery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id || !tab.url) {
        throw new Error('No active tab.');
      }
      if (!/^https?:/.test(tab.url)) {
        throw new Error('Support Finder only works on regular web pages (http / https).');
      }
      setPageUrl(tab.url);
      const req: PopupRequest = {
        kind: 'discover',
        tabId: tab.id,
        url: tab.url,
      };
      const res = (await chrome.runtime.sendMessage(req)) as PopupResponse;
      if (!res?.ok) throw new Error(res?.error || 'Discovery failed.');
      setResult(res.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runDiscovery();
  }, [runDiscovery]);

  const refresh = useCallback(async () => {
    if (!result) {
      await runDiscovery();
      return;
    }
    const req: PopupRequest = { kind: 'clear-cache', origin: result.origin };
    await chrome.runtime.sendMessage(req);
    await runDiscovery();
  }, [result, runDiscovery]);

  const draftText = useMemo(() => {
    if (!result) return '';
    return buildDraft(result, pageUrl);
  }, [result, pageUrl]);

  const copyDraft = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setDraftCopied(true);
      setTimeout(() => setDraftCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [draftText]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={runDiscovery} />;
  if (!result) return <EmptyState onRetry={runDiscovery} />;

  const { best, alternatives } = result;
  const hostname = result.hostname || 'this site';

  return (
    <div className="flex flex-col">
      <Header hostname={hostname} fromCache={result.fromCache} onRefresh={refresh} />

      <div className="flex border-b border-gray-200 px-4">
        <TabButton active={view === 'results'} onClick={() => setView('results')}>
          Results
        </TabButton>
        <TabButton active={view === 'draft'} onClick={() => setView('draft')}>
          Draft message
        </TabButton>
      </div>

      {view === 'results' ? (
        <div className="p-4 flex flex-col gap-4">
          {best ? <BestCard candidate={best} /> : <NoResultCard hostname={hostname} />}

          {alternatives.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Other options
              </div>
              <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                {alternatives.map((c, i) => (
                  <CandidateRow
                    key={`${c.type}-${c.value}-${i}`}
                    candidate={c}
                    divider={i < alternatives.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <DraftPanel text={draftText} copied={draftCopied} onCopy={copyDraft} />
      )}

      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Header({
  hostname,
  fromCache,
  onRefresh,
}: {
  hostname: string;
  fromCache: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="px-4 pt-4 pb-3 border-b border-gray-200 flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="text-xs font-medium text-gray-500">Support for</div>
        <div className="text-sm font-semibold text-gray-900 truncate">{hostname}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {fromCache && (
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-0.5 text-[11px] text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            cached
          </span>
        )}
        <button
          onClick={onRefresh}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded px-1"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'text-gray-900 font-medium border-b-2 border-blue-600 pb-2.5 pt-3 -mb-[1px] mr-5 text-sm focus-visible:outline-none'
          : 'text-gray-500 font-normal border-b-2 border-transparent hover:text-gray-700 pb-2.5 pt-3 mr-5 text-sm focus-visible:outline-none'
      }
    >
      {children}
    </button>
  );
}

function BestCard({ candidate }: { candidate: SupportCandidate }) {
  const isEmail = candidate.type === 'email';
  const [copied, setCopied] = useState(false);

  const onPrimary = useCallback(async () => {
    if (isEmail) {
      try {
        await navigator.clipboard.writeText(candidate.value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* ignore */
      }
      return;
    }
    chrome.tabs.create({ url: candidate.value });
  }, [candidate.value, isEmail]);

  const onCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(candidate.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [candidate.value]);

  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <TypePill type={candidate.type} />
          <div className="text-base font-semibold text-gray-900 truncate">{candidate.label}</div>
          {!isEmail && (
            <div className="text-xs text-gray-500 truncate">{safeHost(candidate.value)}</div>
          )}
        </div>
        <ConfidenceRing score={candidate.score} />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onPrimary}
          className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-medium rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors"
        >
          {isEmail ? (copied ? 'Copied' : 'Copy email') : 'Open'}
        </button>
        {!isEmail && (
          <button
            onClick={onCopyLink}
            className="bg-blue-50 text-blue-600 text-sm font-medium rounded-lg px-3 py-2 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}
      </div>

      <div className="text-xs text-gray-500">
        <span className="text-gray-400 mr-2">-</span>
        {candidate.reason}
      </div>
    </div>
  );
}

function NoResultCard({ hostname }: { hostname: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-5 bg-white flex flex-col gap-2">
      <div className="text-sm font-semibold text-gray-900">No public support contact found</div>
      <div className="text-sm text-gray-500">
        We couldn&apos;t identify a reliable support channel for{' '}
        <span className="font-medium text-gray-700">{hostname}</span>. Try opening the site&apos;s
        footer, About page, or Help center directly.
      </div>
    </div>
  );
}

function DraftPanel({
  text,
  copied,
  onCopy,
}: {
  text: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <pre className="whitespace-pre-wrap break-words text-sm text-gray-700 font-sans m-0">
          {text}
        </pre>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className="flex-1 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-medium rounded-lg px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors"
        >
          {copied ? 'Copied' : 'Copy draft'}
        </button>
      </div>
      <div className="text-xs text-gray-500">
        <span className="text-gray-400 mr-2">-</span>
        Draft is a template. Nothing is sent automatically.
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
      <span className="text-[11px] text-gray-500">
        Best-effort public discovery. Accuracy varies by site.
      </span>
    </div>
  );
}

function safeHost(href: string): string {
  try {
    return new URL(href).hostname;
  } catch {
    return href;
  }
}
