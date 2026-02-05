"use client";

import { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Loader2, Trash2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfiniteDataTable } from "@/components/ui/infinite-datatable";
import { useInfiniteScroll } from "@/components/ui/infinite-datatable/hooks";
import { DataTableStateProvider } from "@/components/ui/infinite-datatable/model/datatable-store";
import ColumnsMenu from "@/components/ui/infinite-datatable/ui/columns-menu.tsx";
import DataTableFilter, { DataTableFilterList } from "@/components/ui/infinite-datatable/ui/datatable-filter";
import { ColumnFilter } from "@/components/ui/infinite-datatable/ui/datatable-filter/utils";
import { DataTableSearch } from "@/components/ui/infinite-datatable/ui/datatable-search";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Agent } from "@/lib/agents/types";
import { useToast } from "@/lib/hooks/use-toast";
import { PlaygroundInfo } from "@/lib/playground/types";
import { swrFetcher } from "@/lib/utils";

import ClientTimestampFormatter from "../client-timestamp-formatter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import Header from "../ui/header";
import Mono from "../ui/mono";
import CreatePlaygroundDialog from "./create-playground-dialog";

const columns: ColumnDef<PlaygroundInfo>[] = [
  {
    cell: ({ row }) => <Mono>{row.original.id}</Mono>,
    size: 300,
    header: "ID",
    id: "id",
  },
  {
    id: "name",
    accessorKey: "name",
    header: "Name",
    size: 300,
  },
  {
    id: "createdAt",
    header: "Created",
    accessorKey: "createdAt",
    cell: (row) => <ClientTimestampFormatter timestamp={String(row.getValue())} />,
  },
];

export const defaultPlaygroundsColumnOrder = ["__row_selection", "id", "name", "createdAt"];

const playgroundsTableFilters: ColumnFilter[] = [
  {
    name: "ID",
    key: "id",
    dataType: "string",
  },
  {
    name: "Name",
    key: "name",
    dataType: "string",
  },
];

const FETCH_SIZE = 50;

const PlaygroundsContent = () => {
  const { projectId } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isSimulating, setIsSimulating] = useState(false);

  const filter = searchParams.getAll("filter");
  const search = searchParams.get("search");

  const { data: agentsData } = useSWR<{ items: Agent[] }>(
    projectId ? `/api/projects/${projectId}/agents` : null,
    swrFetcher
  );

  const agents = agentsData?.items ?? [];

  const fetchPlaygrounds = useCallback(
    async (pageNumber: number) => {
      try {
        const urlParams = new URLSearchParams();
        urlParams.set("pageNumber", pageNumber.toString());
        urlParams.set("pageSize", FETCH_SIZE.toString());

        filter.forEach((f) => urlParams.append("filter", f));

        if (typeof search === "string" && search.length > 0) {
          urlParams.set("search", search);
        }

        const url = `/api/projects/${projectId}/playgrounds?${urlParams.toString()}`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          const text = await res.json();
          throw new Error(text.error || "Failed to fetch tests");
        }

        const data = await res.json();
        return { items: data.items, count: data.totalCount };
      } catch (error) {
        toast({
          title: error instanceof Error ? error.message : "Failed to load tests. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [projectId, toast, filter, search]
  );

  const {
    data: playgrounds,
    hasMore,
    isFetching,
    isLoading,
    fetchNextPage,
    updateData,
  } = useInfiniteScroll<PlaygroundInfo>({
    fetchFn: fetchPlaygrounds,
    enabled: true,
    deps: [projectId, filter, search],
  });

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeletePlaygrounds = async (playgroundIds: string[]) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/playgrounds?playgroundIds=${playgroundIds.join(",")}`, {
        method: "DELETE",
      });

      if (res.ok) {
        updateData((currentData) => currentData.filter((playground) => !playgroundIds.includes(playground.id)));
        setRowSelection({});
        toast({
          title: "Tests deleted",
          description: `Successfully deleted ${playgroundIds.length} test(s).`,
        });
      } else {
        throw new Error("Failed to delete tests");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete tests. Please try again.",
        variant: "destructive",
      });
    }
    setIsDeleting(false);
    setIsDeleteDialogOpen(false);
  };

  const simulateIncident = async (
    type: "jailbreak" | "risky-tool" | "policy-violation" | "approval-completed"
  ) => {
    if (!projectId) return;
    if (!selectedAgentId) {
      toast({ title: "Select an agent first", variant: "destructive" });
      return;
    }

    const payload = {
      jailbreak: {
        eventType: "agent_response_blocked",
        summary: "Blocked tool call: jailbreak attempt",
        reason: "Detected prompt injection pattern",
        action: "Blocked before sending",
        details: { simulation: true, scenario: "jailbreak", threatCategory: "jailbreaks" },
      },
      "risky-tool": {
        eventType: "guardrail_triggered",
        summary: "Approval requested: risky tool call",
        reason: "Sensitive data extraction detected",
        action: "Awaiting approval",
        details: {
          simulation: true,
          scenario: "risky_tool_call",
          approvalRequested: true,
          threatCategory: "data_exfiltration",
        },
      },
      "policy-violation": {
        eventType: "agent_paused_auto",
        summary: "Agent auto-paused (policy: Medium+)",
        reason: "Repeated high-risk outputs detected",
        action: "Paused for safety",
        details: { simulation: true, scenario: "policy_violation", threatCategory: "policy_manipulation" },
      },
      "approval-completed": {
        eventType: "agent_response_sent",
        summary: "Approval completed",
        reason: "Operator approved the response",
        action: "Response sent to channel",
        details: { simulation: true, scenario: "approval_completed", approvalCompleted: true },
      },
    }[type];

    setIsSimulating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/agents/${selectedAgentId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to simulate event");
      }

      toast({ title: "Simulation sent", description: "Check Activity and Incidents for the new event." });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Failed to simulate event",
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <>
      <Header path={[{ name: "Test Mode" }]} />
      <div className="flex flex-col gap-4 px-4 pb-4 overflow-hidden">
        <Card>
          <CardHeader>
            <CardTitle>Simulate risky scenarios</CardTitle>
            <CardDescription>
              Trigger demo events to validate guardrails. Results will appear in Activity and Incidents.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} · {agent.channel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={isSimulating}
              onClick={() => simulateIncident("jailbreak")}
            >
              Simulate jailbreak
            </Button>
            <Button
              variant="outline"
              disabled={isSimulating}
              onClick={() => simulateIncident("risky-tool")}
            >
              Simulate risky tool call
            </Button>
            <Button
              variant="outline"
              disabled={isSimulating}
              onClick={() => simulateIncident("policy-violation")}
            >
              Simulate guardrail trigger
            </Button>
            <Button
              variant="outline"
              disabled={isSimulating}
              onClick={() => simulateIncident("approval-completed")}
            >
              Simulate approval complete
            </Button>
          </CardContent>
        </Card>
        <CreatePlaygroundDialog />
        <InfiniteDataTable
          enableRowSelection={true}
          getRowHref={(row) => `/project/${projectId}/test/${row.original.id}`}
          getRowId={(row) => row.id}
          columns={columns}
          data={playgrounds ?? []}
          hasMore={hasMore}
          isFetching={isFetching}
          isLoading={isLoading}
          fetchNextPage={fetchNextPage}
          state={{
            rowSelection,
          }}
          onRowSelectionChange={setRowSelection}
          lockedColumns={["__row_selection"]}
          selectionPanel={(selectedRowIds) => (
            <div className="flex flex-col space-y-2">
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost">
                    <Trash2 size={12} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Tests</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete {selectedRowIds.length} test(s)? This action cannot be
                      undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                      Cancel
                    </Button>
                    <Button onClick={() => handleDeletePlaygrounds(selectedRowIds)} disabled={isDeleting}>
                      {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        >
          <div className="flex flex-1 w-full space-x-2 pt-1">
            <DataTableFilter columns={playgroundsTableFilters} />
            <ColumnsMenu
              columnLabels={columns.map((column) => ({
                id: column.id!,
                label: typeof column.header === "string" ? column.header : column.id!,
              }))}
              lockedColumns={["__row_selection"]}
            />
            <DataTableSearch className="mr-0.5" placeholder="Search by test name..." />
          </div>
          <DataTableFilterList />
        </InfiniteDataTable>
      </div>
    </>
  );
};

export default function Playgrounds() {
  return (
    <DataTableStateProvider storageKey="playgrounds-table" defaultColumnOrder={defaultPlaygroundsColumnOrder}>
      <PlaygroundsContent />
    </DataTableStateProvider>
  );
}
