type ProgressDotsProps = { total: number; done: number };

export function ProgressDots({ total, done }: ProgressDotsProps) {
  return (
    <span role="img" aria-label={`${done} of ${total} steps done`} className="flex gap-1.5">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`size-2.5 rounded-full ${
            index < done ? "bg-primary" : index === done ? "border-primary border-2" : "bg-chip"
          }`}
        />
      ))}
    </span>
  );
}
