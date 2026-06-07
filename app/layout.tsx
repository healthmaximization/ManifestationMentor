import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Subliminal Academy",
  description: "Create subliminals and access your private audio creation tools."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
