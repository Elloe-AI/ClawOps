import { redirect } from "next/navigation";

export default async function TracePage(props: { params: Promise<{ projectId: string; traceId: string }> }) {
  const params = await props.params;
  redirect(`/project/${params.projectId}/activity/${params.traceId}`);
}
