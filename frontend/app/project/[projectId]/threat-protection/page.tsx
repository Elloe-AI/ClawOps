import { Metadata } from "next";

import Blocks from "@/components/blocks";

export const metadata: Metadata = {
  title: "Threat Protection",
};

export default async function ThreatProtectionPage() {
  return <Blocks />;
}
