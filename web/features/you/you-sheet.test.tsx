import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { emittedToday } from "@/infrastructure/app-events";
import { defaultBear } from "@/features/avatar/bear-config";
import { emptyProfile } from "@/features/onboarding/profile";
import { emptyStoryState, storyProgress } from "@/features/story/engine";
import { storyFixture } from "@/test/story";
import { YouSheet } from "./you-sheet";
import type { PersonLook, YouProfile } from "./you-summary";

const lumi = { name: "Lumi", bear: defaultBear };
const look: PersonLook = {
  body: "slim",
  skin: "tone-6",
  hair: "curly",
  outfit: "office",
  accent: "blue",
};
const progress = storyProgress(
  storyFixture,
  { ...emptyStoryState, choice: "story", done: ["arrive/settle", "arrive/office"] },
  emittedToday,
);

function Harness({ profile, person }: { profile: YouProfile; person?: PersonLook | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        You
      </button>
      {open && (
        <YouSheet
          profile={profile}
          person={person}
          agent={lumi}
          story={progress}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function openSheet(profile: YouProfile = emptyProfile, person?: PersonLook) {
  render(<Harness profile={profile} person={person} />);
  const opener = screen.getByRole("button", { name: "You" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

const tab = (name: string) => screen.getByRole("tab", { name });
const panelText = () => screen.getByRole("tabpanel").textContent;

describe("YouSheet", () => {
  test("opens as a modal on the Profile tab with focus on it", () => {
    openSheet({ role: "researcher", goal: "test-site", visibility: "private" }, look);
    expect(document.querySelector("dialog")!.open).toBe(true);
    expect(document.activeElement).toBe(tab("Profile"));
    expect(tab("Profile").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe("you-tab-profile");
    expect(panelText()).toContain("RoleResearcher");
    expect(panelText()).toContain("GoalFind a test site or data");
    expect(panelText()).toContain("Who sees your profileOnly me");
    expect(panelText()).toContain("HairCurly");
  });

  test("arrow keys, Home and End move a roving tabindex and select as they go", () => {
    openSheet();
    expect(screen.getByRole("tablist", { name: "About you" })).toBeTruthy();
    const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
    const tabIndexes = () =>
      screen.getAllByRole("tab").map((element) => element.getAttribute("tabindex"));

    press("ArrowRight");
    expect(document.activeElement).toBe(tab("Goals"));
    expect(tab("Goals").getAttribute("aria-selected")).toBe("true");
    expect(tabIndexes()).toEqual(["-1", "0", "-1", "-1", "-1"]);

    press("End");
    expect(document.activeElement).toBe(tab("Agents"));
    press("ArrowRight");
    expect(document.activeElement).toBe(tab("Profile"));
    press("ArrowLeft");
    expect(document.activeElement).toBe(tab("Agents"));
    press("Home");
    expect(document.activeElement).toBe(tab("Profile"));
    expect(tabIndexes()).toEqual(["0", "-1", "-1", "-1", "-1"]);
  });

  test("an empty profile says where each missing part comes from", () => {
    openSheet();
    expect(panelText()).toContain("No look chosen yet. It comes from the look step when you join.");
    fireEvent.click(tab("Goals"));
    expect(panelText()).toContain("No goal chosen yet. It comes from the goal step when you join.");
    fireEvent.click(tab("Skills"));
    expect(panelText()).toContain("No expertise yet. It comes from the expertise step");
    fireEvent.click(tab("People"));
    expect(panelText()).toContain("No connections yet.");
    expect(screen.queryAllByRole("img")).toEqual([]);
  });

  test("Goals shows the goal and required quests done from the story", () => {
    openSheet({ ...emptyProfile, goal: "collaborator" });
    fireEvent.click(tab("Goals"));
    expect(panelText()).toContain("Find a collaborator");
    expect(screen.getByText("1 of 8 required quests done")).toBeTruthy();
    const rows = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(rows.slice(0, 2)).toEqual(["Arrive and settleDone", "Find the right peopleNow"]);
  });

  test("Skills lists the player's own expertise when there is some", () => {
    openSheet({ ...emptyProfile, expertise: ["glucose sensors", "clinical trials"] });
    fireEvent.click(tab("Skills"));
    const list = screen.getByRole("list", { name: "Your expertise" });
    expect(Array.from(list.children).map((item) => item.textContent)).toEqual([
      "glucose sensors",
      "clinical trials",
    ]);
  });

  test("Agents names Lumi, the bear's look and where skills and loops live", () => {
    openSheet();
    fireEvent.click(tab("Agents"));
    expect(screen.getByText("Lumi")).toBeTruthy();
    expect(panelText()).toContain("KindBern bear");
    expect(panelText()).toContain("FurHoney");
    expect(screen.getByText("Lumi's skills and loops live in the Agents app.")).toBeTruthy();
  });

  test("Close shuts the sheet and gives focus back to what opened it", async () => {
    const opener = openSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
