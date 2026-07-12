export default function SkeletonRow() {
  return (
    <div className="bg-surface rounded-[14px] border border-border p-5 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-5 h-5 rounded bg-surface-2" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 bg-surface-2 rounded" />
          <div className="h-3 w-1/4 bg-surface-2 rounded" />
        </div>
        <div className="h-6 w-16 bg-surface-2 rounded-full" />
      </div>
    </div>
  );
}
