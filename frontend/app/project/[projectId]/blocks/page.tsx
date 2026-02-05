import { Metadata } from "next";

import Header from "@/components/ui/header";
import Blocks from "@/components/blocks";

export const metadata: Metadata = {
  title: "Threat Protection",
};

export default async function BlocksPage() {
  return (
    <div className="flex flex-col h-full">
      <Header path={[{ name: "Threat Protection" }]} />
      <div className="flex-1 overflow-y-auto py-8">
        <Blocks />
      </div>
    </div>
  );
}
