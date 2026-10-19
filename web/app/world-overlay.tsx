"use client";

import type { ComponentProps, ReactNode } from "react";
import { DesktopDialog } from "@/features/desktop/desktop";
import { Toasts } from "@/features/notifications/toasts";
import { notificationStore } from "@/features/notifications/use-notifications";
import { Phone } from "@/features/phone/phone";
import { StoryMenu } from "@/features/story/story-menu";
import { YouSheet } from "@/features/you/you-sheet";

type WorldOverlayProps = {
  phone: Omit<ComponentProps<typeof Phone>, "overlay">;
  desktop: Omit<ComponentProps<typeof DesktopDialog>, "overlay">;
  /** The You sheet while it is open. */
  you: ComponentProps<typeof YouSheet> | null;
  storyMenu: ComponentProps<typeof StoryMenu>;
  /** Bärli's chat and the settle dialog, each composed in its own module. */
  lumiChat: ReactNode;
  settleDialog: ReactNode;
  reducedMotion: boolean;
};

// Everything above the world: the phone, the desk, sheets and dialogs, and the toasts.
export function WorldOverlay({
  phone,
  desktop,
  you,
  storyMenu,
  lumiChat,
  settleDialog,
  reducedMotion,
}: WorldOverlayProps) {
  // The desk and the phone are modal dialogs, so toasts move inside the open one, or nobody sees
  // them. Moving remounts them: a toast still up when the desk opens or closes leaves the screen
  // (under reduced motion too) but stays unread in the bell. One instance would need the toasts to
  // live above the dialog, which a modal makes inert.
  const toasts = <Toasts store={notificationStore()} reducedMotion={reducedMotion} />;
  return (
    <>
      <Phone {...phone} overlay={phone.open ? toasts : undefined} />
      <DesktopDialog {...desktop} overlay={desktop.open && toasts} />
      {you && <YouSheet {...you} />}
      {lumiChat}
      {settleDialog}
      {!desktop.open && !phone.open && toasts}
      <StoryMenu {...storyMenu} />
    </>
  );
}
