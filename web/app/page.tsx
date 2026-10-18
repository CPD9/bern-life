import { connection } from "next/server";
import { Suspense } from "react";
import { loadStory } from "@/features/story/load-story";
import { worldDemoSearch } from "@/features/world/demo-search";
import { env } from "@/infrastructure/env";
import { WorldApp } from "./world-app";

async function WorldForRequest({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  // DEMO_FIXTURES is read per request, so one build serves both fixture and engine mode.
  await connection();
  const fixtureMode = env().demoFixtures;
  const { story } = await searchParams;
  return (
    <WorldApp
      fixtureMode={fixtureMode}
      demoSearch={fixtureMode ? worldDemoSearch() : undefined}
      story={loadStory()}
      storyDemo={story === "demo"}
    />
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense
      fallback={<div className="from-sky-top to-sky-bottom fixed inset-0 bg-linear-to-b" />}
    >
      <WorldForRequest searchParams={searchParams} />
    </Suspense>
  );
}
