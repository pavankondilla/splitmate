import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Page title */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-8">
        {/* Avatar + name/email */}
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-full shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-3 w-60" />
          </div>
        </div>

        <Skeleton className="h-px w-full" />

        {/* Name field */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-72" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md shrink-0" />
          </div>
        </div>

        <Skeleton className="h-px w-full" />

        {/* Email field */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-3 w-80" />
        </div>

        <Skeleton className="h-px w-full" />

        {/* Info card */}
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}
