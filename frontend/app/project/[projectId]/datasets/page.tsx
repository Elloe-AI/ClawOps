import { redirect } from "next/navigation";

export default async function LogsPage(props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  redirect(`/project/${params.projectId}/history`);
}
