import type { Metadata } from "next";
import { StartApp } from "./start-app";

export const metadata: Metadata = { title: "Join · Bern Life" };

export default function Start() {
  return <StartApp />;
}
