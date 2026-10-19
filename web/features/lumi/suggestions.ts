// The messages a suggestion chip sends, word for word, because Lumi has recorded answers for exact
// strings only. They are the first turns of the conversations in infra/demo/agent.jsonl, recorded
// live and shipped in the bundle's cache, so they replay with no model.

export type Suggestion = { readonly label: string; readonly text: string };

export const suggestions: readonly Suggestion[] = [
  {
    label: "Who works on glucose sensors at DCB?",
    text: "Who works on glucose sensors at DCB?",
  },
  {
    label: "Wer arbeitet am DCB an Glukosesensoren?",
    text: "Wer arbeitet am DCB an Glukosesensoren?",
  },
  {
    label: "Qui travaille sur les capteurs de glucose au DCB ?",
    text: "Qui travaille sur les capteurs de glucose au DCB ?",
  },
];
