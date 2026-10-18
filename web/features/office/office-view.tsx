type OfficeViewProps = {
  /** Sit down at the desk: opens the office computer. */
  onUseDesk: () => void;
  /** Step out of the door onto the map of Bern. */
  onGoOutside: () => void;
};

// Home is your office. For now a simple panel; the 3D room (you, Lumi, the desk and the door)
// takes its place behind the same two actions.
export function OfficeView({ onUseDesk, onGoOutside }: OfficeViewProps) {
  return (
    <div className="from-sky-top to-sky-bottom absolute inset-0 flex items-end justify-center bg-linear-to-b px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:items-center sm:pb-0">
      <section
        aria-labelledby="office-title"
        className="bg-panel shadow-panel flex w-full max-w-md flex-col gap-4 rounded-3xl p-6"
      >
        <h1 id="office-title" className="text-2xl font-extrabold">
          Your office
        </h1>
        <p className="text-muted">
          Your base in Bern. Work at the computer: ask the Navigator, keep your reports, write to
          your network. Or step outside to the map.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onUseDesk}
            className="bg-primary text-primary-ink rounded-pill px-5 py-2.5 font-bold"
          >
            Use the computer
          </button>
          <button
            type="button"
            onClick={onGoOutside}
            className="bg-chip rounded-pill px-5 py-2.5 font-bold"
          >
            Go outside
          </button>
        </div>
      </section>
    </div>
  );
}
