// Invented members for DEMO_FIXTURES only, so the directory and an office visit can be shown
// without real accounts. Nobody here is a real person or comes from a public page. The app labels
// each one DEMO, and none can be messaged or asked to connect: no account stands behind them.
// Their handles hold a hyphen, which sign-up never accepts, so no member can take one.
import type { DirectoryEntry, Office } from "./store";

export type DemoEntry = DirectoryEntry & { demo: true };

const members = [
  { handle: "demo-lena", displayName: "Lena Beispiel", role: "researcher" },
  { handle: "demo-marco", displayName: "Marco Esempio", role: "company" },
  { handle: "demo-sophie", displayName: "Sophie Exemple", role: "practitioner" },
] as const;

export const DEMO_MEMBERS: readonly DemoEntry[] = members.map((member) => ({
  ...member,
  canVisit: true,
  demo: true,
}));

/** A demo member's office: open to anyone, furnished as every office is. */
export function demoOffice(handle: string): Office | null {
  const member = members.find((candidate) => candidate.handle === handle);
  return member === undefined
    ? null
    : {
        handle,
        displayName: member.displayName,
        plot: null,
        layout: null,
        visitVisibility: "public",
      };
}
