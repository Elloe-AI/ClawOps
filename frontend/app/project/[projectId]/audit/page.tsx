import { Metadata } from "next";

import Dashboard from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "Data / Audit",
};

export default async function AuditPage() {
  return <Dashboard headerLabel="Data / Audit" />;
}
