import type { Metadata } from "next";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";

export const metadata: Metadata = {
  title: "Messages · Bern Life",
};

export default function MessagesPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted text-sm font-bold">Bern Life</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Messages</h1>
        <p className="text-muted">
          Only the people in a conversation can read it. Messages never reach the AI.
        </p>
      </header>
      <StandaloneMessagesPage />
    </main>
  );
}
