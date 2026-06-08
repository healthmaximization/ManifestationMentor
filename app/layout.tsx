import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Subliminal Academy",
  description: "Create subliminals and access your private audio creation tools.",
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
