export function SpecsList({ specs }: { specs: { label: string; value: string }[] }) {
  if (specs.length === 0) return null;
  return (
    <dl className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
      {specs.map((spec) => (
        <div key={spec.label} className="grid grid-cols-3 gap-4 px-4 py-3">
          <dt className="text-muted-foreground">{spec.label}</dt>
          <dd className="col-span-2">{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}