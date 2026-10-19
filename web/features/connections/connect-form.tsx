"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/infrastructure/ui/button";
import { NOTE_MAX } from "./input";

type ConnectFormProps = {
  name: string;
  onSend: (note: string) => Promise<boolean>;
  onCancel: () => void;
};

// The note that goes with a request: optional, at most 280 characters, counted as you type. The
// field takes focus when the form opens; Cancel gives it back to whoever opened it.
export function ConnectForm({ name, onSend, onCancel }: ConnectFormProps) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const countId = useId();

  useEffect(() => field.current?.focus(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    const sent = await onSend(note);
    setSending(false);
    if (sent) setNote("");
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex w-full flex-col gap-2">
      <label htmlFor={fieldId} className="text-sm font-bold">
        A note for {name} (optional)
      </label>
      <textarea
        ref={field}
        id={fieldId}
        value={note}
        maxLength={NOTE_MAX}
        rows={3}
        aria-describedby={countId}
        onChange={(event) => setNote(event.target.value)}
        className="bg-chip focus-visible:outline-focus rounded-2xl px-3 py-2 focus-visible:outline-3"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={countId} className="text-muted text-xs">
          {note.length} of {NOTE_MAX} characters
        </span>
        <div className="flex gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={sending}>
            Send request
          </Button>
        </div>
      </div>
    </form>
  );
}
