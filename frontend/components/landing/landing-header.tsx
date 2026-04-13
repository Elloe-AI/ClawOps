"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import GitHubButton from "react-github-btn";

import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";

import { Button } from "../ui/button";

interface LandingHeaderProps {
  hasSession: boolean;
}

export default function LandingHeader({ hasSession }: LandingHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="flex flex-col md:flex-row w-full justify-between md:justify-center items-center z-50 backdrop-blur-lg">
      <div className="w-full px-4 flex flex-col md:flex-row container justify-between">
        <div className="flex items-center h-20 justify-between">
          <Link href="/" className="-mt-1">
            <BrandMark priority size="md" />
          </Link>
          <div className="md:hidden">
            {isMenuOpen ? (
              <X className="w-6 h-6 cursor-pointer" onClick={() => setIsMenuOpen(false)} />
            ) : (
              <Menu className="w-6 h-6 cursor-pointer" onClick={() => setIsMenuOpen(true)} />
            )}
          </div>
        </div>
        <nav
          className={cn(
            "pb-8 md:p-0 w-full md:w-auto z-50 flex flex-col md:flex-row md:flex gap-2 items-center md:h-20 text-sm font-semibold tracking-normal text-white",
            isMenuOpen ? "" : "hidden"
          )}
        >
          <div className="flex items-center gap-6 font-title flex-col md:flex-row">
            <Link href="https://clawops.ai/docs" target="_blank">Docs</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/pricing">Pricing</Link>
            <Link target="_blank" href="https://discord.gg/nNFUUDAKub">
              Discord
            </Link>
            <GitHubButton
              href="https://github.com/clawops/clawops"
              data-color-scheme="no-preference: dark; light: dark; dark: dark;"
              data-size="large"
              data-show-count="true"
              aria-label="Star TruthChecker on GitHub"
            >
              Star
            </GitHubButton>
          </div>
          {hasSession ? (
            <Link className="hidden lg:block" href="/projects">
              <Button>Mission Control</Button>
            </Link>
          ) : (
            <>
              <Link className="hidden lg:block" href="/sign-in">
                <Button variant="outline">Sign in</Button>
              </Link>
              <Link className="hidden lg:block" href="/sign-up">
                <Button>Sign up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
