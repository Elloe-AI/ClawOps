import { Metadata } from "next";

import Header from "@/components/ui/header";
import Agents from "@/components/agents";

export const metadata: Metadata = {
  title: "Agents",
};

export default async function AgentsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header path="agents" />
      <div className="flex-1 overflow-y-auto py-8">
        <Agents />
      </div>
    </div>
  );
}
