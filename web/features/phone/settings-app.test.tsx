import { afterEach, expect, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { applySettings, defaultSettings, settingsKey } from "@/infrastructure/settings";
import { SettingsApp } from "./settings-app";

afterEach(() => {
  localStorage.removeItem(settingsKey);
});

test("night mode and lite graphics write their attributes on <html> and are saved", () => {
  render(<SettingsApp />);
  const night = screen.getByRole("group", { name: "Night mode" });
  const lite = screen.getByRole("group", { name: "Lite graphics" });
  fireEvent.click(within(night).getByLabelText("On"));
  fireEvent.click(within(lite).getByLabelText("On"));
  const root = document.documentElement;
  try {
    expect(root.getAttribute("data-theme")).toBe("night");
    expect(root.getAttribute("data-graphics")).toBe("lite");
    expect(JSON.parse(localStorage.getItem(settingsKey)!)).toEqual({
      night: "on",
      lite: true,
      dataSaver: false,
    });
  } finally {
    applySettings(root, defaultSettings);
  }
});
