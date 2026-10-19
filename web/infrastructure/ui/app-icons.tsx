const paths = {
  ask: "M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4z",
  messages: "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  agents:
    "M12 3v3m-5 3h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zm2.5 4.5h.01m5 0h.01M9.5 16.5h5",
  reports: "M7 3h7l4 4v14H7zm7 0v4h4M10 12h5m-5 4h5",
  library: "M5 4h3v16H5zm5 0h3v16h-3zm5.2 1 2.9-.8 3.7 15-2.9.8z",
  opportunities: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z",
  garage: "M3 10l9-6 9 6v10H3zm4 10v-6h10v6M7 17h10",
  sources:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8 3-2.1-.7.6-2.1-1.9-1.9-2.1.6L13.8 5h-3.6l-.7 2.1-2.1-.6-1.9 1.9.6 2.1L4 12l2.1.7-.6 2.1 1.9 1.9 2.1-.6.7 2.1h3.6l.7-2.1 2.1.6 1.9-1.9-.6-2.1z",
} as const;

export type AppIconName = keyof typeof paths;

export function AppIcon({ app }: { app: AppIconName }) {
  return (
    <svg
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
