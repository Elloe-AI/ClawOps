import { Metadata } from "next";

import DashboardEditor from "@/components/dashboard/editor";

export const metadata: Metadata = {
  title: "Data / Audit",
};

export default async function AuditNewPage() {
  return <DashboardEditor />;
}
