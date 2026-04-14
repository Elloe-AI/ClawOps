import Image from "next/image";

import fullLogo from "@/assets/full.png";
import transparentLogo from "@/assets/ms-icon-310x310-removebg-preview.png";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandMarkSize = "sm" | "md" | "lg";
type BrandMarkVariant = "icon" | "full";

interface BrandMarkProps {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  size?: BrandMarkSize;
  variant?: BrandMarkVariant;
}

const sizeMap: Record<BrandMarkVariant, Record<BrandMarkSize, string>> = {
  icon: {
    sm: "w-20",
    md: "w-28",
    lg: "w-40",
  },
  full: {
    sm: "w-32",
    md: "w-48",
    lg: "w-64",
  },
};

export function BrandMark({
  className,
  imageClassName,
  priority = false,
  size = "md",
  variant = "icon",
}: BrandMarkProps) {
  const logo = variant === "full" ? fullLogo : transparentLogo;

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        alt={`${APP_NAME} logo`}
        className={cn("h-auto", sizeMap[variant][size], imageClassName)}
        priority={priority}
        src={logo}
      />
    </span>
  );
}
