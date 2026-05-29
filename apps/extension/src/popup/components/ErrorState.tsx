export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="p-5 flex flex-col gap-3">
      <div className="text-sm font-semibold text-gray-900">Couldn&apos;t scan this page</div>
      <div className="text-sm text-gray-500">{message}</div>
      <button
        onClick={onRetry}
        className="self-start bg-blue-50 text-blue-600 text-sm font-medium rounded-full px-3 py-1.5 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
