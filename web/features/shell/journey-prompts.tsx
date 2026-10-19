// Gentle invitations along the first run. Neither blocks the map; both can be ignored.

const cardClass =
  "bg-panel shadow-panel border-panel-border flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-3xl border p-4";

export const joinHref = "/account?next=/start";

export function JoinPrompt({ onNotNow }: { onNotNow: () => void }) {
  return (
    <section aria-label="Join Bern Life" className={cardClass}>
      <p className="font-bold">Keep what you found: join Bern Life.</p>
      <p className="text-muted text-sm">
        Joining is by invite. What you did on the map so far stays counted.
      </p>
      <div className="flex gap-2">
        <a
          href={joinHref}
          className="bg-primary text-primary-ink rounded-pill px-4 py-1.5 text-sm font-bold"
        >
          Join
        </a>
        <button
          type="button"
          onClick={onNotNow}
          className="rounded-pill px-3 py-1.5 text-sm font-bold"
        >
          Not now
        </button>
      </div>
    </section>
  );
}

export function OnboardingPrompt() {
  return (
    <section aria-label="Set up your profile" className={cardClass}>
      <p className="font-bold">You&apos;re in. Tell us who you are, then pick your bear.</p>
      <a
        href="/start"
        className="bg-primary text-primary-ink rounded-pill self-start px-4 py-1.5 text-sm font-bold"
      >
        Set up my profile
      </a>
    </section>
  );
}

export function SettlePrompt({
  onChoose,
  onNotNow,
}: {
  onChoose: () => void;
  onNotNow: () => void;
}) {
  return (
    <section aria-label="Choose where to settle" className={cardClass}>
      <p className="font-bold">Choose where your office stands in Bern.</p>
      <p className="text-muted text-sm">Each plot lists the places near it, with their sources.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onChoose}
          className="bg-primary text-primary-ink rounded-pill px-4 py-1.5 text-sm font-bold"
        >
          Choose a plot
        </button>
        <button
          type="button"
          onClick={onNotNow}
          className="rounded-pill px-3 py-1.5 text-sm font-bold"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
