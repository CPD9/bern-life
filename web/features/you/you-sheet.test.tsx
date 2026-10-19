import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { emittedToday } from "@/infrastructure/app-events";
import { defaultBear } from "@/features/avatar/bear-config";
import { emptyProfile } from "@/features/onboarding/profile";
import { emptyStoryState, storyProgress } from "@/features/story/engine";
import { storyFixture } from "@/test/story";
import { AgentsPanel } from "./you-panels";
import { YouSheet } from "./you-sheet";
import { YouTabs } from "./you-tabs";
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
    const panel = screen.getByRole("tabpanel");
    expect(panel.getAttribute("aria-labelledby")).toBe(tab("Profile").id);
    expect(tab("Profile").getAttribute("aria-controls")).toBe(panel.id);
    expect(panelText()).toContain("RoleResearcher");
    expect(panelText()).toContain("GoalFind a test site or data");
    expect(panelText()).toContain("Who sees your profileOnly me");
    expect(panelText()).toContain("HairCurly");
  });

  test("the dialog is named by its title and the panel is reachable with Tab", () => {
    openSheet();
    expect(screen.getByRole("dialog", { name: "You" })).toBeTruthy();
    expect(screen.getByRole("tabpanel").getAttribute("tabindex")).toBe("0");
  });

  test("two tab sets on a page never share an id", () => {
    const tabs = [{ id: "one", label: "One", panel: "First panel" }] as const;
    const tabSet = () => <YouTabs tabs={tabs} selected="one" onSelect={() => {}} label="Set" />;
    render(
      <>
        {tabSet()}
        {tabSet()}
      </>,
    );
    const ids = Array.from(document.querySelectorAll("[id]"), (element) => element.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
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
    expect(screen.getByText("0 of 4 required quests done")).toBeTruthy();
    const rows = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(rows.slice(0, 2)).toEqual(["Find the right peopleNow", "Ask it differentlyOpen"]);
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
    expect(screen.getByText("Your agent, a bear.")).toBeTruthy();
  });

  test("the agent line names the agent's kind from its look", () => {
    const kinds = [
      ["polar-bear", "snow", "Your agent, a polar bear."],
      ["red-panda", "rust", "Your agent, a red panda."],
      ["ibex", "fawn", "Your agent, an ibex."],
    ] as const;
    for (const [kind, fur, line] of kinds) {
      const { unmount } = render(
        <AgentsPanel agent={{ name: "Pip", bear: { ...defaultBear, kind, fur } }} />,
      );
      expect(screen.getByText(line)).toBeTruthy();
      unmount();
    }
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
