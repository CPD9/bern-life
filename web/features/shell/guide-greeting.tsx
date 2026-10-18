// The guide's first line on the map. Kept in this one component so the floatie can replace it
// with a one-file change.
export function GuideGreeting({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      aria-label="Your guide"
      className="bg-panel shadow-panel border-panel-border flex w-[min(20rem,calc(100vw-2rem))] items-start gap-3 rounded-3xl border p-4"
    >
      <p className="flex-1 font-bold">
        Hi, I&apos;m your guide. Tap a place to see who works there.
      </p>
      <button
        type="button"
        aria-label="Close the greeting"
        onClick={onDismiss}
        className="text-muted -mt-1 rounded-full px-2 font-bold"
      >
        ✕
      </button>
    </section>
  );
}
