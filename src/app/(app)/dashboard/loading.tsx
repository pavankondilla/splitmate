import { Skeleton } from "@/components/ui/skeleton";

function RoomCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Title */}
      <Skeleton className="h-5 w-2/5" />
      {/* Stats row */}
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
      {/* Balance */}
      <Skeleton className="h-5 w-32" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Room cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <RoomCardSkeleton />
        <RoomCardSkeleton />
        <RoomCardSkeleton />
      </div>
    </div>
  );
}
