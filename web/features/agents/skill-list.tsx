"use client";

import type { NumbersState } from "@/infrastructure/use-numbers";
import { EvidenceList } from "./evidence-list";
import { skillEvidence } from "./skill-evidence";
import { type Skill, skills } from "./skills";

type SkillListProps = {
  /** /api/numbers as loaded by the host, for the measured rows. */
  numbers: NumbersState;
  fixtureMode: boolean;
  /** Without it the list is read-only, as in the Garage. */
  onTry?: (skill: Skill) => void;
};

export function SkillList({ numbers, fixtureMode, onTry }: SkillListProps) {
  return (
    <ul className="flex flex-col gap-3">
      {skills.map((skill) => (
        <li key={skill.id} className="border-panel-border flex flex-col gap-3 border-b pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h4 className="font-extrabold">{skill.name}</h4>
              <p className="text-muted text-sm">{skill.sentence}</p>
            </div>
            {onTry && (
              <button
                type="button"
                onClick={() => onTry(skill)}
                aria-label={`Try ${skill.name}`}
                className="bg-chip rounded-pill shrink-0 px-4 py-1.5 text-sm font-bold"
              >
                Try
              </button>
            )}
          </div>
          <EvidenceList
            evidence={skillEvidence(skill, numbers, fixtureMode)}
            label={`Evidence: ${skill.name}`}
          />
        </li>
      ))}
    </ul>
  );
}
