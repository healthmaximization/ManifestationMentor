import type { Metadata } from "next";
import AcademyLanding from "@/components/academy-landing";

export const metadata: Metadata = {
  title: "Subliminal Academy | Make Subliminals Work for You",
  description: "Join Subliminal Academy for step-by-step courses, systems, accountability, and a community built for consistent subliminal listeners."
};

export default function AcademyPage() {
  return <AcademyLanding />;
}
