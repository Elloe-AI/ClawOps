import {
  Bot,
  Database,
  LayoutGrid,
  PlayCircle,
  Rows4,
  Settings,
  Shield,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

export interface SidebarMenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface SidebarCategory {
  name: string;
  items: SidebarMenuItem[];
}

export const getSidebarMenus = (projectId: string): SidebarCategory[] => [
  {
    name: "Mission",
    items: [
      {
        name: "Mission Control",
        href: `/project/${projectId}/mission-control`,
        icon: LayoutGrid,
      },
      {
        name: "Agents",
        href: `/project/${projectId}/agents`,
        icon: Bot,
      },
      {
        name: "Activity",
        href: `/project/${projectId}/activity`,
        icon: Rows4,
      },
      {
        name: "Incidents",
        href: `/project/${projectId}/incidents`,
        icon: AlertTriangle,
      },
    ],
  },
  {
    name: "Safety",
    items: [
      {
        name: "Guardrails",
        href: `/project/${projectId}/guardrails`,
        icon: Shield,
      },
      {
        name: "Threat Protection",
        href: `/project/${projectId}/threat-protection`,
        icon: ShieldCheck,
      },
    ],
  },
  {
    name: "Testing",
    items: [
      {
        name: "Test Mode",
        href: `/project/${projectId}/test-mode`,
        icon: PlayCircle,
      },
    ],
  },
  {
    name: "Data / Audit",
    items: [
      {
        name: "Data / Audit",
        href: `/project/${projectId}/audit`,
        icon: Database,
      },
      // {
      //   name: "Labeling",
      //   href: `/project/${projectId}/labeling-queues`,
      //   icon: Pen,
      // },
      // {
      //   name: "Evaluators",
      //   href: `/project/${projectId}/evaluators`,
      //   icon: SquareFunction,
      // },
    ],
  },
  {
    name: "Settings",
    items: [
      {
        name: "Settings",
        href: `/project/${projectId}/settings`,
        icon: Settings,
      },
    ],
  },
  // {
  //   name: "Monitoring",
  //   items: [
  //     {
  //       name: "Dashboards",
  //       href: `/project/${projectId}/dashboard`,
  //       icon: LayoutGrid,
  //     },
  //     {
  //       name: "Policies",
  //       href: `/project/${projectId}/policies`,
  //       icon: Shield,
  //     },
  //     {
  //       name: "Traces",
  //       href: `/project/${projectId}/traces`,
  //       icon: Rows4,
  //     },
  //   ],
  // },
  // {
  //   name: "Development",
  //   items: [
  //     {
  //       name: "Playgrounds",
  //       href: `/project/${projectId}/playgrounds`,
  //       icon: PlayCircle,
  //     },
  //     {
  //       name: "Sql editor",
  //       href: `/project/${projectId}/sql`,
  //       icon: SquareTerminal,
  //     },
  //   ],
  // },
  // {
  //   name: "Data Management",
  //   items: [
  //     {
  //       name: "Datasets",
  //       href: `/project/${projectId}/datasets`,
  //       icon: Database,
  //     },
  //     // {
  //     //   name: "Labeling",
  //     //   href: `/project/${projectId}/labeling-queues`,
  //     //   icon: Pen,
  //     // },
  //     // {
  //     //   name: "Evaluators",
  //     //   href: `/project/${projectId}/evaluators`,
  //     //   icon: SquareFunction,
  //     // },
  //   ],
  // },
  // {
  //   name: "Configuration",
  //   items: [
  //     {
  //       name: "Settings",
  //       href: `/project/${projectId}/settings`,
  //       icon: Settings,
  //     },
  //   ],
  // },
];
