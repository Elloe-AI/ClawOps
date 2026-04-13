import "@/app/globals.css";
import "@/app/scroll.css";

import { Metadata } from "next";
import { Suspense } from "react";

import { Toaster } from "@/components/ui/toaster";
import { APP_DESCRIPTION, APP_NAME, APP_URL } from "@/lib/brand";
import { manrope, sans } from "@/lib/fonts";
import { cn } from "@/lib/utils";

import PostHogPageView from "./posthog-pageview";
import { PHProvider } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: APP_NAME,
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  keywords: [
    "truthchecker",
    "clawops",
    "agent operations",
    "bot operations",
    "ai agents",
    "channel ops",
    "guardrails",
    "agent safety",
    "ai observability",
    "telegram bots",
    "discord bots",
    "whatsapp bots",
    "sms bots",
  ],
  openGraph: {
    type: "website",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    siteName: APP_NAME,
    images: {
      url: "/opengraph-image.png",
      alt: APP_NAME,
    },
  },
  twitter: {
    card: "summary",
    description: APP_DESCRIPTION,
    title: APP_NAME,
    images: {
      url: "/twitter-image.png",
      alt: APP_NAME,
    },
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full antialiased", sans.variable, manrope.variable)}>
      <PHProvider>
        <body className="flex flex-col h-full">
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <div className="flex">
            <div className="flex flex-col grow max-w-full min-h-screen">
              <main className="z-10 flex flex-col grow">{children}</main>
              <Toaster />
            </div>
          </div>
        </body>
      </PHProvider>
    </html>
  );
}
