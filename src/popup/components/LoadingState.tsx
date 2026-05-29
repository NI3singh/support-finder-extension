export function LoadingState() {
  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="text-xs font-medium text-gray-500">Scanning page</div>
          <div className="h-4 w-32 rounded bg-gray-100 animate-pulse" />
        </div>
        <div className="h-9 w-9 rounded-full bg-gray-100 animate-pulse" />
      </div>
      <div className="rounded-xl border border-gray-200 p-4 bg-white flex flex-col gap-3">
        <div className="h-3 w-20 rounded-full bg-gray-100 animate-pulse" />
        <div className="h-4 w-48 rounded bg-gray-100 animate-pulse" />
        <div className="h-8 w-full rounded-lg bg-gray-100 animate-pulse" />
      </div>
      <div className="text-xs text-gray-500">
        <span className="text-gray-400 mr-2">-</span>
        Inspecting links, footer, and structured data
      </div>
    </div>
  );
}
