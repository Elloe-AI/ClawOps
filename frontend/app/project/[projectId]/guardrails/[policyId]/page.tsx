import { redirect } from "next/navigation";

export default async function GuardrailPage(props: { params: Promise<{ projectId: string; policyId: string }> }) {
  const params = await props.params;
  redirect(`/project/${params.projectId}/guardrails`);
}
