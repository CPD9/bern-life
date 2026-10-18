import { type PlaceKind } from "../places";

// One simple pictogram per kind, drawn in the marker's ink colour: a columned building for an
// institute, a flask for a platform, a cross in a circle for a centre.
const PATHS: Readonly<Record<PlaceKind, string>> = {
  institute: "M3 9 12 4l9 5v1H3zM5 11h2v7H5zm4 0h2v7H9zm4 0h2v7h-2zm4 0h2v7h-2zM3 19h18v2H3z",
  platform:
    "M9 3h6v2h-1v5.2l5.3 8.3A1.6 1.6 0 0 1 18 21H6a1.6 1.6 0 0 1-1.3-2.5L10 10.2V5H9zm3 9.4L8.4 18h7.2z",
  centre:
    "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm-1.5 3h3v3.5H17v3h-3.5V17h-3v-3.5H7v-3h3.5z",
};

export function Pictogram({ kind }: { kind: PlaceKind }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
      <path d={PATHS[kind]} fillRule="evenodd" />
    </svg>
  );
}
