import { Metadata } from "next";

import Header from "@/components/ui/header";
import AgentActivity from "@/components/agents/agent-activity";

export const metadata: Metadata = {
  title: "Agent Activity",
};

export default async function AgentActivityPage(props: { params: Promise<{ projectId: string; agentId: string }> }) {
  const params = await props.params;

  return (
    <div className="flex flex-col h-full">
      <Header path="agents/activity" />
      <div className="flex-1 overflow-y-auto py-8">
        <AgentActivity agentId={params.agentId} />
      </div>
    </div>
  );
}
