import { Metadata } from "next";

import LaunchFlow from "@/components/launch/launch-flow";

export const metadata: Metadata = {
  title: "Launch",
};

export default function LaunchPage() {
  return <LaunchFlow />;
}
