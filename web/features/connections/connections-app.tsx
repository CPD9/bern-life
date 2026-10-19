"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/infrastructure/ui/button";
import { type ConnectionsApi, FAILURE_TEXT, type Member } from "./connections-api";
import type { Answer } from "./input";
import { MemberRow } from "./member-row";
import { connectedPeople, relationTo, waitingForYou } from "./network";
import { OfficeVisit } from "./office-visit";
import type { ConnectionsController } from "./use-connections";

type ConnectionsAppProps = {
  controller: ConnectionsController;
  api: ConnectionsApi;
  /** Opens Messages with a direct thread to this handle. */
  onMessage: (handle: string) => void;
  /** The office room as a visitor sees it, from the host. */
  renderRoom: (ownerName: string) => ReactNode;
};

const answered: Record<Answer, string> = {
  accept: "Accepted.",
  decline: "Declined.",
  withdraw: "Request withdrawn.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-muted text-xs font-bold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  );
}

// Connections: members who share their profile with you, requests waiting for your answer, and
// the people you are connected with. People found on public pages are never members here; they
// stay search results with their source. Opening the app reads the lists again.
export function ConnectionsApp({ controller, api, onMessage, renderRoom }: ConnectionsAppProps) {
  const [visiting, setVisiting] = useState<Member | null>(null);
  const [notice, setNotice] = useState("");
  // When an answer or a request removes the button that was pressed, focus moves to the sentence
  // that says what happened, not to the top of the page.
  const status = useRef<HTMLParagraphElement>(null);
  const { refresh } = controller;
  useEffect(() => void refresh(), [refresh]);

  if (controller.status === "loading") {
    return (
      <p role="status" className="text-muted">
        Loading members…
      </p>
    );
  }
  if (controller.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p role="alert">Members could not be loaded. {FAILURE_TEXT.network}</p>
        <Button onClick={() => void refresh()}>Try again</Button>
      </div>
    );
  }

  const { requests, signedIn } = controller;
  const waiting = waitingForYou(requests);
  const connected = connectedPeople(requests);

  async function respond(id: string, answer: Answer) {
    const done = await controller.answer(id, answer);
    setNotice(done ? answered[answer] : "");
    status.current?.focus();
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted text-sm">
        Members of Bern Life who share their profile with you. Researchers found on public pages
        show up in search with their source, never here.
      </p>
      {!signedIn && (
        <p className="text-sm">
          Sign in to message members and connect.{" "}
          <a href="/account" className="font-bold underline">
            Sign in or join
          </a>
        </p>
      )}
      {waiting.length > 0 && (
        <Section title="Asking to connect">
          <ul>
            {waiting.map((request) => (
              <li
                key={request.id}
                className="border-panel-border flex flex-col gap-2 border-b py-3"
              >
                <span>
                  <span className="font-bold">{request.person.displayName}</span>{" "}
                  <span className="text-muted text-sm">@{request.person.handle}</span>
                </span>
                {request.note && <p className="text-sm whitespace-pre-line">{request.note}</p>}
                <div className="flex gap-2">
                  <Button variant="primary" onClick={() => void respond(request.id, "accept")}>
                    Accept
                  </Button>
                  <Button onClick={() => void respond(request.id, "decline")}>Decline</Button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {signedIn && (
        <Section title="Your connections">
          {connected.length === 0 ? (
            <p className="bg-chip rounded-2xl p-3 text-sm">
              No connections yet. Ask a member below; they show here once they accept.
            </p>
          ) : (
            <ul>
              {connected.map((person) => (
                <li
                  key={person.handle}
                  className="border-panel-border flex items-center justify-between gap-2 border-b py-2 last:border-b-0"
                >
                  <span>
                    <span className="font-bold">{person.displayName}</span>{" "}
                    <span className="text-muted text-sm">@{person.handle}</span>
                  </span>
                  <Button
                    onClick={() => onMessage(person.handle)}
                    aria-label={`Message ${person.displayName}`}
                  >
                    Message
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
      <Section title="Members">
        {controller.members.length === 0 ? (
          <p className="bg-chip rounded-2xl p-3 text-sm">
            No other members share their profile with you yet.
          </p>
        ) : (
          <ul>
            {controller.members.map((member) => (
              <MemberRow
                key={member.handle}
                member={member}
                relation={relationTo(member.handle, requests)}
                signedIn={signedIn}
                onVisit={() => setVisiting(member)}
                onMessage={() => onMessage(member.handle)}
                onAsk={async (note) => {
                  const sent = await controller.ask(member.handle, note);
                  setNotice(sent ? `Request sent to ${member.displayName}.` : "");
                  if (sent) status.current?.focus();
                  return sent;
                }}
                onAnswer={(id, answer) => void respond(id, answer)}
              />
            ))}
          </ul>
        )}
      </Section>
      <p
        ref={status}
        tabIndex={-1}
        aria-live="polite"
        className="text-muted min-h-5 text-sm outline-none"
      >
        {notice}
      </p>
      {controller.failure !== null && (
        <p role="alert" className="bg-warn-bg text-warn-ink rounded-2xl px-4 py-3">
          {FAILURE_TEXT[controller.failure]}
        </p>
      )}
      {visiting !== null && (
        <OfficeVisit
          member={visiting}
          api={api}
          renderRoom={renderRoom}
          onClose={() => setVisiting(null)}
        />
      )}
    </div>
  );
}
