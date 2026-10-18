import { connection } from "next/server";
import { Suspense } from "react";
import { worldDemoSearch } from "@/features/world/demo-search";
import { env } from "@/infrastructure/env";
import { WorldApp } from "./world-app";

async function WorldForRequest() {
  // DEMO_FIXTURES is read per request, so one build serves both fixture and engine mode.
  await connection();
  const fixtureMode = env().demoFixtures;
  return (
    <WorldApp fixtureMode={fixtureMode} demoSearch={fixtureMode ? worldDemoSearch() : undefined} />
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={<div className="from-sky-top to-sky-bottom fixed inset-0 bg-linear-to-b" />}
    >
      <WorldForRequest />
    </Suspense>
  );
}
