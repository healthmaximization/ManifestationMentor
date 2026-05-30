import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "AI Manifestation Advisor",
  description: "A manifestation coaching chat app with owner training controls."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

