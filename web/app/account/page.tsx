import type { Metadata } from "next";
import { StandaloneAccountPage } from "@/features/accounts/standalone-account-page";

export const metadata: Metadata = {
  title: "Account · Bern Life",
};

export default function AccountPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted text-sm font-bold">Bern Life</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Your account</h1>
        <p className="text-muted">
          Invite-only for now. Your profile stays private until you choose otherwise.
        </p>
      </header>
      <StandaloneAccountPage />
    </main>
  );
}
