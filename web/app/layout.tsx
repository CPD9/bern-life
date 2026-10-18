import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import { settingsBootScript } from "@/infrastructure/settings";
import "./globals.css";

const rounded = Nunito({
  subsets: ["latin", "latin-ext"],
  variable: "--font-rounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bern Life",
  description:
    "Ask in your words. Get the right Bern experts, each with the sentence that proves it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script sets theme attributes before React hydrates, so they may differ from the
    // server's markup on purpose.
    <html lang="en" className={rounded.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: settingsBootScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
