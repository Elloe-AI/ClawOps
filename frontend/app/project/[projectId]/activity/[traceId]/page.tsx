import { notFound } from "next/navigation";

import ActivityDetail from "@/components/activity/activity-detail";
import { getTrace } from "@/lib/actions/trace";

export default async function ActivityDetailPage(props: { params: Promise<{ projectId: string; traceId: string }> }) {
  const params = await props.params;
  const projectId = params.projectId;
  const traceId = params.traceId;

  const trace = await getTrace({ projectId, traceId });

  if (!trace) {
    return notFound();
  }

  return <ActivityDetail trace={trace} projectId={projectId} traceId={traceId} />;
}
