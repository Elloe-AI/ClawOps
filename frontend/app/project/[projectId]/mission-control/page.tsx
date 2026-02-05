import { Metadata } from "next";

import MissionControl from "@/components/mission-control";

export const metadata: Metadata = {
  title: "Mission Control",
};

export default async function MissionControlPage() {
  return <MissionControl />;
}
