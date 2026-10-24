export function FormNotice({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
    >
      {message}
    </div>
  );
}