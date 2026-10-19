// "How to add a source" reads its field lists from contracts/source.schema.json itself, so the
// guide cannot drift from what the crawler accepts. The example is invented and is checked
// against the same schema in a test.
import schema from "../../../contracts/source.schema.json";

export type FieldGroup = {
  readonly where: string;
  readonly required: readonly string[];
  readonly optional: readonly string[];
};

type SchemaObject = { readonly required: readonly string[]; readonly properties: object };

function group(where: string, object: SchemaObject): FieldGroup {
  const all = Object.keys(object.properties);
  return {
    where,
    required: object.required,
    optional: all.filter((name) => !object.required.includes(name)),
  };
}

export const sourceFields: readonly FieldGroup[] = [
  group("The file", schema),
  group("Each entry in sites", schema.properties.sites.items),
  group("crawl", schema.properties.crawl),
];

// Written out by hand, as in the playbook, so it reads at phone width; a test parses it and
// validates it against the schema.
export const exampleSourceText = String.raw`{
  "id": "demo-institute",
  "name": "Demo Institute (invented example)",
  "sites": [
    {
      "host": "example.org",
      "unit": "Demo Institute",
      "seeds": ["https://example.org/"],
      "allow_paths": ["/team/"]
    }
  ],
  "crawl": { "max_pages_per_site": 50, "delay_s": 1.0 },
  "page_types": [
    {
      "kind": "person",
      "url_pattern": "^https://example\\.org/team/[a-z-]+$"
    }
  ]
}`;

const exampleId = "demo-institute";

export type GuideStep = { readonly text: string; readonly commands: readonly string[] };

export const guideSteps: readonly GuideStep[] = [
  {
    text: `Save it as sources/${exampleId}.json and check it against the schema.`,
    commands: ["python contracts/check.py"],
  },
  {
    text: "Crawl only that source. The crawler reads robots.txt first, waits between requests and stores each page with its URL, date and sha256.",
    commands: [`python -m bernlife crawl --source ${exampleId}`],
  },
  {
    text: "Extract profiles with evidence. Every value keeps a verbatim sentence from its stored page, checked in code.",
    commands: [`python -m bernlife extract --source ${exampleId}`],
  },
  {
    text: "Add the retrieval terms and the vectors.",
    commands: ["python -m bernlife enrich", "python -m bernlife embed"],
  },
  {
    text: "Load the bundle into Postgres, one transaction per source.",
    commands: ["python -m bernlife load"],
  },
];
