// The browser's end of the live stream. When the stream cannot be held (a proxy, a flaky network),
// the caller falls back to polling; notices carry ids only, so the caller fetches what changed.
import { parseNotice } from "./notice";
import type { Notice } from "./types";

export type LiveSource = {
  onMessage(listener: (data: string) => void): void;
  onError(listener: () => void): void;
  close(): void;
};
export type Connect = (onNotice: (notice: Notice) => void, onDown: () => void) => () => void;

export function connectOver(open: (url: string) => LiveSource): Connect {
  return (onNotice, onDown) => {
    const source = open("/api/messages/stream");
    source.onMessage((data) => {
      const notice = parseNotice(data);
      if (notice !== null) onNotice(notice);
    });
    source.onError(() => {
      source.close();
      onDown();
    });
    return () => source.close();
  };
}

export const connectLive: Connect = connectOver((url) => {
  const source = new EventSource(url);
  return {
    onMessage: (listener) => source.addEventListener("message", (event) => listener(event.data)),
    onError: (listener) => {
      source.onerror = () => listener();
    },
    close: () => source.close(),
  };
});

export const POLL_MS = 10_000;
