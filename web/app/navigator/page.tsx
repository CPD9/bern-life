import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { StandaloneNavigator } from "@/features/navigator/standalone-navigator";
import { env } from "@/infrastructure/env";

export const metadata: Metadata = {
  title: "Navigator · Bern Life",
};

async function NavigatorForRequest() {
  // DEMO_FIXTURES is read per request, so one build serves both fixture and engine mode.
  await connection();
  return <StandaloneNavigator fixtureMode={env().demoFixtures} />;
}

export default function NavigatorPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted text-sm font-bold">
          Bern Life · Research &amp; Expertise Navigator
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Ask in your words. Get the right Bern experts, each with the sentence that proves it.
        </h1>
        <p className="text-muted">
          Public pages of the University of Bern, ARTORG and Diabetes Center Berne. Every claim
          opens the sentence on the page that supports it.
        </p>
      </header>
      <Suspense>
        <NavigatorForRequest />
      </Suspense>
    </main>
  );
}
