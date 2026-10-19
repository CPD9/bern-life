// The five panels of the You sheet. Each shows stored answers or an empty state that says where the
// missing part comes from; nothing here is estimated, scored or made up to fill a gap.
import type { StoryProgress } from "@/features/story/engine";
import {
  type Agent,
  type Fact,
  type PersonLook,
  type YouProfile,
  bearFacts,
  expertiseOf,
  furColour,
  goalOf,
  personFacts,
  profileFacts,
  storyTally,
} from "./you-summary";

function Facts({ label, facts }: { label: string; facts: readonly Fact[] }) {
  return (
    <dl aria-label={label} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {facts.map((fact) => (
        <div key={fact.label} className="contents">
          <dt className="text-muted font-bold">{fact.label}</dt>
          <dd className="font-bold">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Heading({ children }: { children: string }) {
  return <h3 className="text-muted text-xs font-bold tracking-wide uppercase">{children}</h3>;
}

function Empty({ children }: { children: string }) {
  return <p className="bg-chip rounded-2xl p-3 text-sm">{children}</p>;
}

export function ProfilePanel({
  profile,
  person,
}: {
  profile: YouProfile;
  person: PersonLook | undefined;
}) {
  return (
    <>
      <Facts label="Your answers" facts={profileFacts(profile)} />
      <Heading>Your look</Heading>
      {person ? (
        <Facts label="Your look" facts={personFacts(person)} />
      ) : (
        <Empty>No look chosen yet. It comes from the look step when you join.</Empty>
      )}
      <p className="text-muted text-sm">
        Everything here stays in this browser until you save it to an account.
      </p>
    </>
  );
}

const statusWords = { done: "Done", current: "Now", ready: "Open", coming: "Coming next" };

export function GoalsPanel({ profile, story }: { profile: YouProfile; story: StoryProgress }) {
  const goal = goalOf(profile);
  const { done, required } = storyTally(story);
  const quests = story.quests.filter(({ quest }) => !quest.optional);
  return (
    <>
      <Heading>Your goal</Heading>
      {goal ? (
        <p className="font-bold">{goal}</p>
      ) : (
        <Empty>No goal chosen yet. It comes from the goal step when you join.</Empty>
      )}
      <Heading>Story</Heading>
      <p className="font-bold">
        {done} of {required} required quests done
      </p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {quests.map(({ quest, status }) => (
          <li key={quest.id} className="flex items-baseline justify-between gap-3">
            <span>{quest.title}</span>
            <span className="text-muted shrink-0 text-xs font-bold">{statusWords[status]}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function SkillsPanel({ profile }: { profile: YouProfile }) {
  const expertise = expertiseOf(profile);
  if (expertise.length === 0) {
    return (
      <Empty>
        No expertise yet. It comes from the expertise step, where you name what you know in your own
        words.
      </Empty>
    );
  }
  return (
    <>
      <Heading>Your expertise</Heading>
      <ul aria-label="Your expertise" className="flex flex-wrap gap-2">
        {expertise.map((item) => (
          <li key={item} className="bg-chip rounded-pill px-3 py-1 text-sm font-bold">
            {item}
          </li>
        ))}
      </ul>
      <p className="text-muted text-sm">In your own words, as you gave them.</p>
    </>
  );
}

export function PeoplePanel() {
  return (
    <>
      <Empty>No connections yet. People you connect with in Bern Life will appear here.</Empty>
      <p className="text-muted text-sm">
        Researchers found on public pages show up as search results with their source, never as
        characters in the world.
      </p>
    </>
  );
}

export function AgentsPanel({ agent }: { agent: Agent }) {
  const colour = furColour(agent.bear);
  return (
    <>
      <div className="flex items-center gap-3">
        {colour && (
          <span
            aria-hidden="true"
            style={{ backgroundColor: colour }}
            className="border-panel-border size-10 shrink-0 rounded-full border"
          />
        )}
        <div>
          <p className="text-lg font-extrabold">{agent.name}</p>
          <p className="text-muted text-sm">Your agent, a bear.</p>
        </div>
      </div>
      <Facts label={`${agent.name}'s look`} facts={bearFacts(agent.bear)} />
      <p className="text-sm">{agent.name}&apos;s skills and loops live in the Agents app.</p>
    </>
  );
}
