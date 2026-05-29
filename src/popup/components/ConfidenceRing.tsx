/**
 * Small circular confidence indicator. Track gray, progress orange,
 * matches the design system's "Circular Data Rings" anatomy.
 */

export function ConfidenceRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(1, score));
  const size = 36;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const display = Math.round(pct * 100);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Confidence ${display}%`}
    >
      <svg width={size} height={size} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#EA580C"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-gray-900">
        {display}
      </div>
    </div>
  );
}
