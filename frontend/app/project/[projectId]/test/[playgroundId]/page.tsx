import { Metadata } from "next";

import { HipocapAnalysisPlayground } from "@/components/playground/hipocap-analysis-playground";
import Header from "@/components/ui/header";

export const metadata: Metadata = {
  title: "Test check",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TestDetailPage(props: {
  params: Promise<{ projectId: string; playgroundId: string }>;
}) {
  const params = await props.params;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header path="test/analysis" />
      <HipocapAnalysisPlayground />
    </div>
  );
}
