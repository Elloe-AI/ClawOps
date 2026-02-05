import { Metadata } from "next";

import Header from "@/components/ui/header";
import AgentOnboarding from "@/components/agents/agent-onboarding";

export const metadata: Metadata = {
  title: "Connect Agent",
};

export default async function AgentOnboardingPage() {
  return (
    <div className="flex flex-col h-full">
      <Header path="agents/connect" />
      <div className="flex-1 overflow-y-auto py-8">
        <AgentOnboarding />
      </div>
    </div>
  );
}
