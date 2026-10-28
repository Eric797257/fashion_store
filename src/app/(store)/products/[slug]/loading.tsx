import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <Skeleton className="h-4 w-64" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Skeleton className="aspect-[4/5] w-full rounded-xl" />
        <div className="space-y-5">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}