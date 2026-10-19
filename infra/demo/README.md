# Recorded demo inputs

The exact inputs whose model calls were recorded live on 19 Oct 2026 and ship in the cache pack of
`bundle-20261019-3`, so they replay with no model. Replay matches a request exactly: change a
character and it is a new question, answered by plain search.

- `queries.jsonl`: `{id, query}` per demo search and project brief (`demo-brief` is the brief in
  `docs/demo.md` step 1; the other briefs describe invented companies).
- `agent.jsonl`: `{id, lang, turns}`, the user's messages of one Navigator conversation per
  language, in order. Each later turn is sent with the replies the engine gave before it, which come
  from the bundle, so no reply naming a person is kept in git.

The briefs and searches were recorded on `bundle-20261019-2`; on `bundle-20261019-3` the model calls
replay unchanged, while result lists differ where #162 removed profiles named after a listing heading.
