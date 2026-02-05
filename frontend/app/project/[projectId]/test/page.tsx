import { Metadata } from "next";

import Playgrounds from "@/components/playgrounds/playgrounds";

export const metadata: Metadata = {
  title: "Test Mode",
};

export default async function TestPage() {
  return <Playgrounds />;
}
