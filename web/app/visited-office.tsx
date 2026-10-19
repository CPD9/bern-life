"use client";

import type { ReactNode } from "react";
import { OfficeRoom } from "@/features/office/office-room";

/** Another member's office as a visitor sees it: read-only, in the player's graphics settings. */
export function visitedOffice(lite: boolean, reducedMotion: boolean) {
  return function VisitedOffice(ownerName: string): ReactNode {
    return <OfficeRoom visiting={ownerName} lite={lite} reducedMotion={reducedMotion} />;
  };
}
