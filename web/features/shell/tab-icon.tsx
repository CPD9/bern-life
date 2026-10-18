import type { ShellTab } from "./tabs";

const paths: Record<ShellTab, string> = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  map: "M9 5 4 7v12l5-2 6 2 5-2V5l-5 2-6-2zm0 0v12m6-10v12",
  phone:
    "M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3zm3 15h2",
};

export function TabIcon({ tab }: { tab: ShellTab }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[tab]} />
    </svg>
  );
}
