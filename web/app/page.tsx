import { GameShell } from "@/features/shell/game-shell";
import { WorldCanvas } from "@/features/world/world-canvas";

export default function Home() {
  return <GameShell canvas={<WorldCanvas />} />;
}
