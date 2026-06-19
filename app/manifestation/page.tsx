import type { Metadata } from "next";
import AcademyLanding from "@/components/academy-landing";

export const metadata: Metadata = {
  title: "Manifestation System | Subliminal Academy",
  description: "Learn a clear manifestation system built around identity, subconscious alignment, consistency, and practical action."
};

export default function ManifestationLandingPage() {
  return <AcademyLanding angle="manifestation" />;
}
