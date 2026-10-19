import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { type MapPlace } from "./nearby";
import { type Plot, PLOTS } from "./plots";
import { Settle } from "./settle";
import { createSettleStore } from "./settle-store";

// Invented places around the Länggasse plot (-50, -36); a unit on the map is about 20 m.
const PLACES: readonly MapPlace[] = [
  {
    id: "demo-lab",
    name: "Demo Sensor Lab",
    x: -50,
    z: -31,
    address_span: "Demostrasse 5, 3012 Bern",
    address_url: "https://www.demo-lab.example.test/contact",
    address_fetched_at: "2026-10-18T12:00:00Z",
  },
  {
    id: "demo-centre",
    name: "Demo Data Centre",
    x: -30,
    z: -36,
    address_span: "Beispielweg 1",
    address_url: "https://www.demo-centre.example.test/",
    address_fetched_at: "2026-10-18T22:30:00Z",
  },
  {
    id: "demo-network",
    name: "Demo Network",
    x: -49,
    z: -36,
    address_span: null,
    address_url: null,
    address_fetched_at: null,
  },
];

function memoryStore() {
  const items = new Map<string, string>();
  return createSettleStore(() => ({
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  }));
}

function open(store = memoryStore()) {
  const onSettled = mock((plot: Plot) => plot.id);
  const onClose = mock(() => undefined);
  render(<Settle places={PLACES} onSettled={onSettled} onClose={onClose} store={store} />);
  return { onSettled, onClose, store };
}

describe("Settle", () => {
  test("a plot lists the nearest sourced places with their address, source and date", () => {
    open();
    fireEvent.click(screen.getByRole("radio", { name: "Länggasse" }));
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("span")?.textContent)).toEqual([
      "Demo Sensor Lab",
      "Demo Data Centre",
    ]);
    expect(within(items[0] as HTMLElement).getByText("about 100 m")).toBeTruthy();
    expect(within(items[0] as HTMLElement).getByText("Demostrasse 5, 3012 Bern").tagName).toBe("Q");
    expect(
      within(items[1] as HTMLElement)
        .getByRole("link", { name: "Source page" })
        .getAttribute("href"),
    ).toBe("https://www.demo-centre.example.test/");
    expect(items[1]?.querySelector("time")?.textContent).toBe("19 Oct 2026");
    expect(within(items[1] as HTMLElement).getByText("about 400 m")).toBeTruthy();
    expect(
      screen.getByText(/^Only places with an address on their own page are listed\./),
    ).toBeTruthy();
    expect(screen.getByText(/Distances are approximate/)).toBeTruthy();
  });

  test("settling reports the plot once, stores it and says where the office is", () => {
    const { onSettled, store } = open();
    fireEvent.click(screen.getByRole("radio", { name: "Länggasse" }));
    const settle = screen.getByRole("button", { name: "Settle in Länggasse" });
    fireEvent.click(settle);
    fireEvent.click(settle);
    expect(onSettled.mock.calls).toEqual([[PLOTS[1] as Plot]]);
    expect(store.get()?.id).toBe("laenggasse");
    expect(settle.textContent).toBe("Your office is here");
    expect(settle.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Your office is in Länggasse.")).toBeTruthy();
  });

  test("it opens on the stored plot, and moving reports the new plot", () => {
    const store = memoryStore();
    store.set(PLOTS[1] as Plot);
    const { onSettled } = open(store);
    expect((screen.getByRole("radio", { name: /^Länggasse/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Your office is here" }));
    expect(onSettled).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "Insel" }));
    fireEvent.click(screen.getByRole("button", { name: "Settle in Insel" }));
    expect(onSettled.mock.calls.map(([plot]) => plot.id)).toEqual(["insel"]);
  });

  test("the server renders it as if nothing were stored, so the first browser render matches", () => {
    const store = memoryStore();
    store.set(PLOTS[1] as Plot);
    const html = renderToString(
      <Settle
        places={PLACES}
        onSettled={() => undefined}
        onClose={() => undefined}
        store={store}
      />,
    );
    expect(html).toContain("Settle in Altstadt");
    expect(html).not.toContain("Your office is");
  });

  test("Close calls back once", () => {
    const { onClose } = open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("when the control that opened it is gone, Close focuses the fallback", () => {
    function Host({ withOpener }: { withOpener: boolean }) {
      return (
        <>
          {withOpener && <button type="button">Choose a plot</button>}
          <button type="button">Next card</button>
        </>
      );
    }
    const { rerender } = render(<Host withOpener />);
    screen.getByRole("button", { name: "Choose a plot" }).focus();
    const fallback = () => screen.getByRole("button", { name: "Next card" });
    render(
      <Settle
        places={PLACES}
        onSettled={() => undefined}
        onClose={() => undefined}
        focusFallback={fallback}
        store={memoryStore()}
      />,
    );
    rerender(<Host withOpener={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(fallback());
  });
});
