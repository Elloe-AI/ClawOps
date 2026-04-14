"use client";

import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import {
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar.tsx";

const SidebarFooterComponent = () => {
  return (
    <SidebarFooter className="mb-2 px-0">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem className="mt-5 mx-0 px-2">
              <Link passHref href="/projects" className="flex items-center">
                <BrandMark
                  className="w-full justify-center"
                  imageClassName="opacity-90"
                  size="sm"
                  variant="icon"
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
