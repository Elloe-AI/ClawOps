import { redirect } from "next/navigation";

export default async function DatasetPage(props: { params: Promise<{ projectId: string; datasetId: string }> }) {
  const params = await props.params;
  redirect(`/project/${params.projectId}/history/${params.datasetId}`);
}
