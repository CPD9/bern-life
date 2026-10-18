"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { httpAccountApi } from "@/features/accounts/account-api";
import { AccountScreen } from "@/features/accounts/account-screen";
import { useAccount } from "@/features/accounts/use-account";
import type { SafeNext } from "@/infrastructure/safe-next";

// After a join or sign-in on this page the player goes on to `next` (already allow-listed by the
// page). Someone who arrives already signed in stays to manage their account.
export function AccountApp({ next }: { next: SafeNext | null }) {
  const router = useRouter();
  const controller = useAccount(httpAccountApi);
  const wasSignedOut = useRef(false);
  const status = controller.state.status;

  useEffect(() => {
    if (status === "signed-out") wasSignedOut.current = true;
    if (status === "signed-in" && wasSignedOut.current && next) router.push(next);
  }, [status, next, router]);

  return <AccountScreen controller={controller} />;
}
