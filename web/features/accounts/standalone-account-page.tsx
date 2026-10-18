"use client";

import { httpAccountApi } from "./account-api";
import { StandaloneAccount } from "./account-screen";

export function StandaloneAccountPage() {
  return <StandaloneAccount api={httpAccountApi} />;
}
