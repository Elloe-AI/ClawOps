import { redirect } from "next/navigation";

export default async function DashboardPage(props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  redirect(`/project/${params.projectId}/mission-control`);
}
