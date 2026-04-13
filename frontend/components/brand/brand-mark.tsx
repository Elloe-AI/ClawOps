import Image from "next/image";

import logo from "@/assets/Logo_main.png";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandMarkSize = "sm" | "md" | "lg";

interface BrandMarkProps {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  size?: BrandMarkSize;
}

const sizeMap: Record<BrandMarkSize, string> = {
  sm: "w-20",
  md: "w-28",
  lg: "w-40",
};

export function BrandMark({
  className,
  imageClassName,
  priority = false,
  size = "md",
}: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        alt={`${APP_NAME} logo`}
        className={cn("h-auto", sizeMap[size], imageClassName)}
        priority={priority}
        src={logo}
      />
    </span>
  );
}
