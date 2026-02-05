import { ChartNoAxesGantt, ChevronDown, List, ListChecks, ListTree, LucideIcon } from "lucide-react";

import { useTraceViewStoreContext } from "@/components/traces/trace-view/trace-view-store.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils.ts";

type ViewTab = "tree" | "timeline" | "timeline-chart" | "reader";

const viewOptions: Record<
  ViewTab,
  {
    icon: LucideIcon;
    label: string;
  }
> = {
  timeline: {
    icon: List,
    label: "Activity timeline",
  },
  "timeline-chart": {
    icon: ChartNoAxesGantt,
    label: "Timeline chart",
  },
  reader: {
    icon: ListChecks,
    label: "Step list",
  },
  tree: {
    icon: ListTree,
    label: "Technical details",
  },
};

const viewTabs: ViewTab[] = ["timeline", "timeline-chart", "reader", "tree"];

export default function ViewDropdown() {
  const { tab, setTab } = useTraceViewStoreContext((state) => ({
    tab: state.tab,
    setTab: state.setTab,
  }));

  const isValidTab = viewTabs.includes(tab as ViewTab);
  const displayTab: ViewTab = isValidTab ? (tab as ViewTab) : "timeline";
  const currentView = viewOptions[displayTab];
  const CurrentIcon = currentView.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-8 px-3.5 text-xs font-semibold rounded-xl border transition-all duration-200 shadow-sm focus-visible:outline-0",
            isValidTab
              ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/15"
              : "border-border/50 bg-background/50 hover:bg-background hover:border-primary/30 hover:text-primary"
          )}
        >
          <CurrentIcon size={14} className="mr-1.5" />
          <span className="capitalize">{currentView.label}</span>
          <ChevronDown size={14} className="ml-1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-xl border-border/50">
        {viewTabs.map((option) => {
          const view = viewOptions[option];
          const OptionIcon = view.icon;
          return (
            <DropdownMenuItem
              key={option}
              onClick={() => setTab(option)}
              className={cn(
                "rounded-lg transition-colors",
                tab === option && "bg-primary/10 text-primary font-medium"
              )}
            >
              <OptionIcon size={14} className="mr-2" />
              {view.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
