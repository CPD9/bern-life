"use client";

import { useState } from "react";
import { Button } from "@/infrastructure/ui/button";
import { StatusChip } from "@/infrastructure/ui/status-chip";
import { ConnectForm } from "./connect-form";
import type { Member } from "./connections-api";
import type { Answer } from "./input";
import type { Relation } from "./network";

const roleWords: Readonly<Record<string, string>> = {
  researcher: "Researcher",
  practitioner: "Practitioner",
  company: "Company or start-up",
  "public-body": "Canton or public body",
  student: "Student",
};

export function roleLabel(role: string | null): string | null {
  return role === null ? null : (roleWords[role] ?? role);
}

type MemberRowProps = {
  member: Member;
  relation: Relation;
  signedIn: boolean;
  onVisit: () => void;
  onMessage: () => void;
  onAsk: (note: string) => Promise<boolean>;
  onAnswer: (id: string, answer: Answer) => void;
};

function RelationControls({
  member,
  relation,
  onAsk,
  onAnswer,
}: Pick<MemberRowProps, "member" | "relation" | "onAsk" | "onAnswer">) {
  const [asking, setAsking] = useState(false);
  if (asking) {
    return (
      <ConnectForm
        name={member.displayName}
        onCancel={() => setAsking(false)}
        onSend={async (note) => {
          const sent = await onAsk(note);
          if (sent) setAsking(false);
          return sent;
        }}
      />
    );
  }
  switch (relation.kind) {
    case "connected":
      return <StatusChip tone="ok">Connected</StatusChip>;
    case "they-declined":
      return <StatusChip tone="neutral">Declined</StatusChip>;
    case "you-asked":
      return (
        <>
          <StatusChip tone="neutral">Request sent</StatusChip>
          <Button onClick={() => onAnswer(relation.id, "withdraw")}>Withdraw</Button>
        </>
      );
    case "asks-you":
      return (
        <>
          <Button variant="primary" onClick={() => onAnswer(relation.id, "accept")}>
            Accept
          </Button>
          <Button onClick={() => onAnswer(relation.id, "decline")}>Decline</Button>
        </>
      );
    default:
      return <Button onClick={() => setAsking(true)}>Connect</Button>;
  }
}

// One member: who they are, and what you can do. A demo member is labelled DEMO and can be
// visited but not messaged or asked, since no account stands behind them.
export function MemberRow({ member, relation, signedIn, ...actions }: MemberRowProps) {
  const role = roleLabel(member.role);
  return (
    <li className="border-panel-border flex flex-col gap-2 border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-bold">{member.displayName}</span>
        {member.demo && <StatusChip tone="warn">DEMO</StatusChip>}
        <span className="text-muted text-sm">@{member.handle}</span>
        {role && <span className="text-muted text-sm">· {role}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {member.canVisit && (
          <Button onClick={actions.onVisit} aria-label={`Visit office of ${member.displayName}`}>
            Visit office
          </Button>
        )}
        {member.demo ? (
          <span className="text-muted text-sm">
            Invented for the demo: no messages or requests.
          </span>
        ) : signedIn ? (
          <>
            <Button onClick={actions.onMessage} aria-label={`Message ${member.displayName}`}>
              Message
            </Button>
            <RelationControls
              member={member}
              relation={relation}
              onAsk={actions.onAsk}
              onAnswer={actions.onAnswer}
            />
          </>
        ) : null}
      </div>
    </li>
  );
}
