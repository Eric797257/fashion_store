import { requirePermission } from "@/server/auth/access";

export const instant = false;

export default async function AdminHome() {
  const access = await requirePermission("admin.access", "/admin");
  const permissions = [...access.permissions].sort();

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-semibold">Admin dashboard</h1>
      <p className="text-muted-foreground">
        This is a protected placeholder. The real dashboard is built in Phase 6.
      </p>

      <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <h2 className="text-xl font-semibold">Your access</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Role: <span className="font-medium text-foreground">{access.role}</span> (rank{" "}
          {access.rank}) · {permissions.length} permissions
        </p>
        <ul className="mt-4 grid gap-1 font-mono text-sm sm:grid-cols-2">
          {permissions.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}