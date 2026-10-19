"use client";

import { type Skill, skills } from "./skills";

export function SkillList({ onTry }: { onTry: (skill: Skill) => void }) {
  return (
    <ul className="flex flex-col gap-3">
      {skills.map((skill) => (
        <li
          key={skill.id}
          className="border-panel-border flex items-start justify-between gap-4 border-b pb-3"
        >
          <div className="flex flex-col gap-1">
            <h4 className="font-extrabold">{skill.name}</h4>
            <p className="text-muted text-sm">{skill.sentence}</p>
          </div>
          <button
            type="button"
            onClick={() => onTry(skill)}
            aria-label={`Try ${skill.name}`}
            className="bg-chip rounded-pill shrink-0 px-4 py-1.5 text-sm font-bold"
          >
            Try
          </button>
        </li>
      ))}
    </ul>
  );
}
