import { requirePermission } from "@/server/auth/access";

export const instant = false;

export default async function RiderHome() {
  await requirePermission("rider.access", "/rider");

  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-semibold">My deliveries</h1>
      <p className="text-muted-foreground">
        Protected placeholder. The delivery list and COD cash collection are built in Phase 5.
      </p>
    </div>
  );
}