export function ComingNext({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="bg-chip text-muted rounded-pill self-start px-3 py-1 text-xs font-bold">
        Coming next
      </span>
      <p>{text}</p>
    </div>
  );
}
