// Three questions to tap when Ask opens, one per language. Each is a question the snapshot bundle
// recorded (infra/demo/queries.jsonl, docs/demo.md), so the first search a visitor makes shows
// Apertus's search terms and results from all three sources, in replay as in a live run.
export type ExampleQuestion = { readonly lang: "en" | "de" | "fr"; readonly query: string };

export const exampleQuestions: readonly ExampleQuestion[] = [
  {
    lang: "en",
    query:
      "Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?",
  },
  { lang: "de", query: "Blutzucker messen" },
  {
    lang: "fr",
    query:
      "Capteur optique pour la surveillance continue de plusieurs métabolites (glucose, lactate, cétones)",
  },
];
