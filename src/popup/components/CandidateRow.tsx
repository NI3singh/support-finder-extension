import { useCallback, useState } from 'react';
import type { SupportCandidate } from '@/types';
import { TypePill } from './TypePill';

export function CandidateRow({
  candidate,
  divider,
}: {
  candidate: SupportCandidate;
  divider?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isEmail = candidate.type === 'email';

  const onAction = useCallback(async () => {
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

  return (
    <div
      className={
        'px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors' +
        (divider ? ' border-b border-gray-200' : '')
      }
    >
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <TypePill type={candidate.type} />
          <span className="text-[11px] font-medium text-gray-500">
            {Math.round(candidate.score * 100)}%
          </span>
        </div>
        <div className="text-sm text-gray-900 truncate font-normal">{candidate.label}</div>
      </div>
      <button
        onClick={onAction}
        className="shrink-0 bg-blue-50 text-blue-600 text-xs font-medium rounded-full px-3 py-1.5 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 transition-colors"
      >
        {isEmail ? (copied ? 'Copied' : 'Copy') : 'Open'}
      </button>
    </div>
  );
}
