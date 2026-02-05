import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlaygroundPage(props: {
  params: Promise<{ projectId: string; playgroundId: string }>;
}) {
  const params = await props.params;
  redirect(`/project/${params.projectId}/test/${params.playgroundId}`);
}
