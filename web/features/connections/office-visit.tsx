"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Sheet } from "@/infrastructure/ui/sheet";
import type { ConnectionsApi, Member } from "./connections-api";

type Door = "knocking" | "open" | "closed" | "unreachable";

type OfficeVisitProps = {
  member: Member;
  api: ConnectionsApi;
  /** The room, read-only: the host renders the office for a visitor. */
  renderRoom: (ownerName: string) => ReactNode;
  onClose: () => void;
};

// A visit asks the server first, which checks the member's visit visibility again, so a list read
// a while ago cannot open an office that has since closed. Nothing in the room can be changed.
export function OfficeVisit({ member, api, renderRoom, onClose }: OfficeVisitProps) {
  const [door, setDoor] = useState<Door>("knocking");

  useEffect(() => {
    let current = true;
    void api.office(member.handle).then((outcome) => {
      if (!current) return;
      if (outcome.ok) setDoor("open");
      else setDoor(outcome.failure === "network" ? "unreachable" : "closed");
    });
    return () => {
      current = false;
    };
  }, [api, member.handle]);

  return (
    <Sheet title={`${member.displayName}'s office`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {door === "knocking" && (
          <p role="status" className="text-muted text-sm">
            Knocking on the door…
          </p>
        )}
        {door === "closed" && <p role="status">This office is not open to you.</p>}
        {door === "unreachable" && (
          <p role="status">The server could not be reached. Try again in a moment.</p>
        )}
        {door === "open" && (
          <>
            <p className="text-muted text-sm">
              {member.demo
                ? "DEMO: an invented member's office, for the demo only. "
                : "You are a visitor: look around; nothing here can be changed. "}
            </p>
            <div className="h-80 overflow-hidden rounded-2xl">{renderRoom(member.displayName)}</div>
          </>
        )}
      </div>
    </Sheet>
  );
}
