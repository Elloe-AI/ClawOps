import { Metadata } from "next";

import ActivityTimeline from "@/components/activity";

export const metadata: Metadata = {
  title: "Activity",
};

export default async function ActivityPage() {
  return <ActivityTimeline />;
}
