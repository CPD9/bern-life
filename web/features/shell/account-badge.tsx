import { joinHref } from "./journey-prompts";

export type HudAccount =
  | { readonly status: "checking" }
  | { readonly status: "signed-out" }
  | { readonly status: "signed-in"; readonly handle: string; readonly colour: string };

const darkInk = "#14202b";
const lightInk = "#ffffff";

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** The ink with the higher WCAG contrast on the bear's fur, so the initial always reads. */
export function inkOn(fur: string): typeof darkInk | typeof lightInk {
  const furLight = luminance(fur) + 0.05;
  const onDark = furLight / (luminance(darkInk) + 0.05);
  const onLight = (luminance(lightInk) + 0.05) / furLight;
  return onDark >= onLight ? darkInk : lightInk;
}

type AccountBadgeProps = {
  account: HudAccount;
  /** Opens the You sheet; without it the badge links to the account page. */
  onOpen?: (() => void) | undefined;
};

export function AccountBadge({ account, onOpen }: AccountBadgeProps) {
  if (account.status === "checking") return null;
  if (account.status === "signed-out") {
    return (
      <a
        href={joinHref}
        className="bg-primary text-primary-ink rounded-pill px-3 py-1 text-xs font-bold"
      >
        Join Bern Life
      </a>
    );
  }
  const face = (
    <>
      <span
        aria-hidden="true"
        style={{ backgroundColor: account.colour, color: inkOn(account.colour) }}
        className="border-panel-border flex size-6 items-center justify-center rounded-full border text-xs font-extrabold"
      >
        {account.handle.slice(0, 1).toUpperCase()}
      </span>
      @{account.handle}
    </>
  );
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-1.5 font-bold"
        aria-label={`You, @${account.handle}`}
      >
        {face}
      </button>
    );
  }
  return (
    <a
      href="/account"
      className="flex items-center gap-1.5 font-bold"
      aria-label={`Your account, @${account.handle}`}
    >
      {face}
    </a>
  );
}
