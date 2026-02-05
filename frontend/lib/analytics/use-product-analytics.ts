"use client";

import { useCallback } from "react";
import { usePostHog } from "posthog-js/react";

import { Feature, isFeatureEnabled } from "@/lib/features/features";

export type ProductEventPayload = {
  name: string;
  projectId?: string;
  agentId?: string;
  metadata?: Record<string, any>;
};

export function useProductAnalytics() {
  const posthog = usePostHog();

  const track = useCallback(
    (event: ProductEventPayload) => {
      if (!event.name) return;

      if (isFeatureEnabled(Feature.POSTHOG)) {
        posthog?.capture(event.name, event.metadata ?? {});
      }

      fetch("/api/product-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
        keepalive: true,
      }).catch(() => undefined);
    },
    [posthog]
  );

  return { track };
}
