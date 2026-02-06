"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import AuditTools from "@/components/audit/audit-tools";
import GridLayout from "@/components/dashboard/grid-layout";
import ClawOpsStatsCards from "@/components/dashboard/clawops-stats-cards";
import ClawOpsTimeSeriesChart from "@/components/dashboard/clawops-timeseries-chart";
import { Button } from "@/components/ui/button";

import DateRangeFilter from "../ui/date-range-filter";
import { GroupByPeriodSelect } from "../ui/group-by-period-select";
import Header from "../ui/header";
import { ScrollArea } from "../ui/scroll-area";

export default function Dashboard({ headerLabel = "Data / Audit" }: { headerLabel?: string }) {
  const { projectId } = useParams();

  return (
    <>
      <Header path={[{ name: headerLabel }]}>
        <div className="h-12 flex gap-2 w-full items-center">
          <DateRangeFilter />
          <GroupByPeriodSelect />
          <Link passHref className="ml-auto" href={`/project/${projectId}/audit/new`}>
            <Button icon="plus">Chart</Button>
          </Link>
        </div>
      </Header>
      <ScrollArea className="h-full">
        <div className="h-full px-6 py-6">
          <AuditTools />
          <ClawOpsStatsCards />
          <ClawOpsTimeSeriesChart />
          <GridLayout />
        </div>
      </ScrollArea>
    </>
  );
}
