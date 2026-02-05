import { redirect } from "next/navigation";

export default async function OverviewPage(props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  redirect(`/project/${params.projectId}/mission-control`);
}
