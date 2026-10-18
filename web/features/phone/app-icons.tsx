const paths = {
  ask: "M10.5 4a6.5 6.5 0 1 0 4.03 11.6l4.43 4.43 1.41-1.41-4.43-4.43A6.5 6.5 0 0 0 10.5 4z",
  messages: "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  agents:
    "M12 3v3m-5 3h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zm2.5 4.5h.01m5 0h.01M9.5 16.5h5",
  projects: "M4 7h16v12H4zM9 7V5h6v2M4 12h16",
  settings:
    "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8 3-2.1-.7.6-2.1-1.9-1.9-2.1.6L13.8 5h-3.6l-.7 2.1-2.1-.6-1.9 1.9.6 2.1L4 12l2.1.7-.6 2.1 1.9 1.9 2.1-.6.7 2.1h3.6l.7-2.1 2.1.6 1.9-1.9-.6-2.1z",
} as const;

export function AppIcon({ app }: { app: keyof typeof paths }) {
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
