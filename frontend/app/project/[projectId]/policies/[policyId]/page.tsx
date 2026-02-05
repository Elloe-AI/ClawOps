import { redirect } from "next/navigation";

export default async function PolicyPage(props: { params: Promise<{ projectId: string; policyId: string }> }) {
  const params = await props.params;
  redirect(`/project/${params.projectId}/guardrails/${params.policyId}`);
}

