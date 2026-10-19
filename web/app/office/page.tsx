import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { env } from "@/infrastructure/env";
import { OfficeApp } from "./office-app";

export const metadata: Metadata = {
  title: "Office computer · Bern Life",
};

async function OfficeForRequest() {
  // DEMO_FIXTURES is read per request, so one build serves both fixture and engine mode.
  await connection();
  return <OfficeApp fixtureMode={env().demoFixtures} />;
}

// The office computer as a plain page, for the jury and for anyone without the 3D world.
export default function OfficePage() {
  return (
    <main className="h-dvh">
      <Suspense>
        <OfficeForRequest />
      </Suspense>
    </main>
  );
}
