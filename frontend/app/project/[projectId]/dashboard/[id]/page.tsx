import { redirect } from "next/navigation";

export default async function ManageDashboardPage(props: { params: Promise<{ projectId: string; id: string }> }) {
  const params = await props.params;
  redirect(`/project/${params.projectId}/audit/${params.id}`);
}
