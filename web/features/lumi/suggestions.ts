// The messages a suggestion chip sends, word for word, because Lumi has recorded answers for exact
// strings only. They are docs/demo.md steps 1 and 2 until the strings recorded for the agent are
// posted under "Recorded strings" on the Run A status issue; then they are swapped here, and
// nowhere else.

export type Suggestion = { readonly label: string; readonly text: string };

export const suggestions: readonly Suggestion[] = [
  {
    label: "Muster Medtech's project brief",
    text: "Muster Medtech AG (an invented company) is building a night-time alarm for people with type 1 diabetes who live alone. We need partners in Bern for continuous glucose sensing, for detecting sleep and movement at night, and for testing such a device with older patients.",
  },
  {
    label: "Is anyone in Bern building a night-time low blood sugar alarm?",
    text: "Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?",
  },
];
