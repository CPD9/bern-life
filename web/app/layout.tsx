import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
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
    <html lang="en" className={rounded.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
