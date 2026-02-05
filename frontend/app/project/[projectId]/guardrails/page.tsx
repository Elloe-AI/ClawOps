import { Metadata } from "next";

import Header from "@/components/ui/header";
import Guardrails from "@/components/guardrails";

export const metadata: Metadata = {
  title: "Guardrails",
};

export default async function GuardrailsPage() {
  return (
    <div className="flex flex-col h-full">
      <Header path="guardrails" />
      <div className="flex-1 overflow-y-auto py-8">
        <Guardrails />
      </div>
    </div>
  );
}
