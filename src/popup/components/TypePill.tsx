import type { SupportType } from '@/types';

const LABELS: Record<SupportType, string> = {
  email: 'Email',
  contact_form: 'Contact Form',
  help_center: 'Help Center',
  live_chat: 'Live Chat',
  support_page: 'Support Page',
  unknown: 'Other',
};

export function TypePill({ type }: { type: SupportType }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-gray-700 self-start">
      <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
      {LABELS[type]}
    </span>
  );
}
