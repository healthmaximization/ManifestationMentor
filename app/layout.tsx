import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Subliminal Academy",
  description: "Create, save, and organize custom subliminals with voice layers, background audio, binaural beats, and Pro member tools.",
  openGraph: {
    title: "Subliminal Academy",
    description: "Create custom subliminals in a guided private studio.",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Subliminal Academy",
    description: "Create custom subliminals in a guided private studio."
  },
  icons: {
    icon: "/sa-logo.png",
    shortcut: "/sa-logo.png",
    apple: "/sa-logo.png"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
