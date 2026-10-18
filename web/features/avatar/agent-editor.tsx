"use client";

// Your first agent, the Navigator: a name and a bear. The bear editor and its 3D view come in as
// one node from app/, so this form never loads three.js.

import { type ReactNode, useId } from "react";
import { agentNameMaxLength, defaultAgentName } from "./agent-name";

type AgentEditorProps = {
  name: string;
  onNameChange: (next: string) => void;
  bearEditor: ReactNode;
};

export function AgentEditor({ name, onNameChange, bearEditor }: AgentEditorProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">
        Your agent finds the right people in Bern for you and shows the sentence that proves each
        match. Give it a name and a bear.
      </p>
      <div className="flex max-w-sm flex-col gap-2">
        <label htmlFor={id} className="text-sm font-extrabold">
          Name
        </label>
        <input
          id={id}
          type="text"
          value={name}
          maxLength={agentNameMaxLength}
          placeholder={defaultAgentName}
          onChange={(event) => onNameChange(event.target.value)}
          className="bg-chip rounded-pill px-4 py-2 font-bold"
        />
      </div>
      {bearEditor}
    </div>
  );
}
