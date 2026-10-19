import { useId } from "react";
import { exampleSourceText, guideSteps, sourceFields } from "./source-guide";

function Names({ names }: { names: readonly string[] }) {
  return names.map((name, index) => (
    <span key={name}>
      {index > 0 && ", "}
      <code>{name}</code>
    </span>
  ));
}

// Case criterion 6: a new institution is configuration, not code. Adding one is a reviewed change
// in the repository, so this explains the step and offers no form.
export function AddSourceGuide() {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-add`} className="flex flex-col gap-4">
      <h3 id={`${id}-add`} className="text-lg font-extrabold">
        How to add a source
      </h3>
      <p>
        A new institution is one JSON file in <code>sources/</code> that follows{" "}
        <code>contracts/source.schema.json</code>. No code changes. It is added and reviewed in the
        repository, so there is no form here.
      </p>
      <h4 className="font-extrabold">Fields</h4>
      <dl className="flex flex-col gap-2">
        {sourceFields.map((group) => (
          <div key={group.where}>
            <dt className="font-bold">{group.where}</dt>
            <dd>
              Required: <Names names={group.required} />
              {group.optional.length > 0 && (
                <>
                  . Optional: <Names names={group.optional} />
                </>
              )}
              .
            </dd>
          </div>
        ))}
      </dl>
      <h4 className="font-extrabold">An invented example</h4>
      <pre className="bg-chip rounded-2xl p-4 text-xs break-words whitespace-pre-wrap">
        <code>{exampleSourceText}</code>
      </pre>
      <h4 className="font-extrabold">Then run, from the repository root</h4>
      <ol className="flex list-decimal flex-col gap-3 pl-5">
        {guideSteps.map((step) => (
          <li key={step.text}>
            <p>{step.text}</p>
            {step.commands.map((command) => (
              <pre
                key={command}
                className="bg-chip mt-1 rounded-lg px-3 py-2 text-xs break-words whitespace-pre-wrap"
              >
                <code>{command}</code>
              </pre>
            ))}
          </li>
        ))}
      </ol>
    </section>
  );
}
