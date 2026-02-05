import { Metadata } from "next";

import Incidents from "@/components/incidents";

export const metadata: Metadata = {
  title: "Incidents",
};

export default async function IncidentsPage() {
  return <Incidents />;
}
