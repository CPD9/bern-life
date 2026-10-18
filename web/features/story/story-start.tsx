import type { StoryController } from "./use-story";

export function StoryStart({ controller }: { controller: StoryController }) {
  const playable = controller.progress.quests.filter(({ status }) => status !== "coming").length;
  return (
    <section
      aria-labelledby="story-start-title"
      className="bg-panel shadow-panel border-panel-border flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 rounded-3xl border p-5"
    >
      <p className="text-muted text-xs font-bold tracking-wide uppercase">Story</p>
      <h2 id="story-start-title" className="text-xl font-extrabold">
        {controller.story.title}
      </h2>
      <p className="text-sm">
        Short quests walk you through finding Bern experts, each showing one part of the case. A
        step finishes only when you actually do it. {playable} of{" "}
        {controller.progress.quests.length} quests can be played today.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={controller.start}
          className="bg-primary text-primary-ink rounded-pill px-5 py-2 font-bold"
        >
          Start the story
        </button>
        <button
          type="button"
          onClick={controller.explore}
          className="bg-chip rounded-pill px-5 py-2 font-bold"
        >
          Explore freely
        </button>
      </div>
    </section>
  );
}
