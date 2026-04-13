"use client";

import { X } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import {
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar.tsx";
import { useLocalStorage } from "@/hooks/use-local-storage.tsx";
import { cn } from "@/lib/utils.ts";

const SidebarFooterComponent = () => {
  const { open, openMobile } = useSidebar();
  const [showStarCard, setShowStarCard] = useLocalStorage("showStarCard", true);

  return (
    <SidebarFooter className="px-0 mb-2">
      <SidebarGroup className={cn((open || openMobile) && showStarCard ? "text-sm" : "hidden")}>
        <SidebarGroupContent>
          <div className={cn("flex flex-col rounded-lg border bg-muted relative p-2")}>
            <div className="flex justify-between items-start">
              <p className="text-xs text-muted-foreground mb-2">Open source edition</p>
              <button onClick={() => setShowStarCard(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <a
              href="https://github.com/clawops/clawops"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-foreground hover:underline"
            >
              View source on GitHub
            </a>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {/* <SidebarMenuItem className="h-8">
              <SidebarMenuButton tooltip="Discord" asChild>
                <Link href="https://discord.gg/nNFUUDAKub" target="_blank" rel="noopener noreferrer">
                  <DiscordLogo className="w-4 h-4" />
                  <span>Support</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem> */}
            {/* <SidebarMenuItem className="h-8">
              <SidebarMenuButton tooltip="Docs" asChild>
                <Link href="https://clawops.ai/docs" target="_blank" rel="noopener noreferrer">
                  <Book size={16} />
                  <span>Docs</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem> */}
            <SidebarMenuItem className="mt-5 mx-0 px-2">
              <Link passHref href="/projects" className="flex items-center">
                <BrandMark
                  className="w-full justify-center"
                  imageClassName="opacity-80"
                  size="sm"
                />
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarFooter>
  );
};

export default SidebarFooterComponent;
