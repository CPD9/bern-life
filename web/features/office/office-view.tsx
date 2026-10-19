import { OfficeRoom, type OfficeRoomProps } from "./office-room";

// Home is your office: the room fills the world between the HUD and the tab bar, and the desk and
// the door are its two ways out. The host passes the player's figure and their agent bear in.
export function OfficeView(room: OfficeRoomProps) {
  return (
    <div className="from-sky-top to-sky-bottom absolute inset-0 bg-linear-to-b pt-[calc(env(safe-area-inset-top)+5rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
      <OfficeRoom {...room} />
    </div>
  );
}
