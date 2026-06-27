import { Skeleton } from "@/components/ui/skeleton";

function ExpenseCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Category icon */}
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            {/* Title + badge */}
            <div className="flex gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            {/* Paid by + date */}
            <Skeleton className="h-4 w-44" />
            {/* Share badge */}
            <Skeleton className="h-6 w-28 rounded-lg" />
          </div>
        </div>
        {/* Amount */}
        <Skeleton className="h-6 w-20 shrink-0" />
      </div>
      {/* Expand toggle */}
      <Skeleton className="h-4 w-36" />
    </div>
  );
}

export default function RoomLoading() {
  return (
    <div className="space-y-6">
      {/* Room header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-52" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24 rounded" />
            <Skeleton className="h-5 w-10 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-8 w-28 rounded-lg shrink-0" />
      </div>

      {/* Tabs + actions row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* Expense cards */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-16 rounded" />
        <ExpenseCardSkeleton />
        <ExpenseCardSkeleton />
        <ExpenseCardSkeleton />
      </div>
    </div>
  );
}
