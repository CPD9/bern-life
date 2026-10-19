const paths = {
  ask: "M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4z",
  messages: "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  // A bear's face (agents are bears): round head, two round ears, eyes, nose.
  agents:
    "M5 14a7 7 0 1 0 14 0 7 7 0 1 0-14 0M9.3 7.54A2.8 2.8 0 1 0 6.08 10.27M14.7 7.54a2.8 2.8 0 1 1 3.22 2.73M9.6 12.8h.01m4.8 0h.01M11 16.2h2l-1 1.1z",
  projects: "M4 7h16v12H4zM9 7V5h6v2M4 12h16",
  reports: "M7 3h7l4 4v14H7zm7 0v4h4M10 12h5m-5 4h5",
  library: "M5 4h3v16H5zm5 0h3v16h-3zm5.2 1 2.9-.8 3.7 15-2.9.8z",
  opportunities: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z",
  garage: "M3 10l9-6 9 6v10H3zm4 10v-6h10v6M7 17h10",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8 3-2.1-.7.6-2.1-1.9-1.9-2.1.6L13.8 5h-3.6l-.7 2.1-2.1-.6-1.9 1.9.6 2.1L4 12l2.1.7-.6 2.1 1.9 1.9 2.1-.6.7 2.1h3.6l.7-2.1 2.1.6 1.9-1.9-.6-2.1z",
} as const;

export type AppIconName = keyof typeof paths;

export function AppIcon({ app }: { app: AppIconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[app]} />
    </svg>
  );
}
