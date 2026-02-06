import Link from "next/link";

import { Button } from "@/components/ui/button";

import PricingCard from "../landing/pricing-card";

interface PricingDialogProps {
  workspaceTier: string;
  workspaceId: string;
  workspaceName: string;
}

const isTierPaid = (tier: string) => tier.toLowerCase().trim() !== "free";

export default function PricingDialog({ workspaceTier, workspaceId, workspaceName }: PricingDialogProps) {
  const addWorkspaceToLink = (link: string) => `${link}&workspaceId=${workspaceId}&workspaceName=${workspaceName}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <div className="p-8 border flex flex-col justify-between">
        <PricingCard
          className="text-secondary-foreground"
          title="Community"
          price="Free"
          features={[
            "1 active agent",
            "Metadata-only telemetry",
            "Guardrails, blocks, and incidents",
            "Activity timeline",
            "Community support",
          ]}
        />
        {workspaceTier === "free" && (
          <div className="mt-4">
            <Button variant="secondary" className="w-full h-10" disabled>
              Current plan
            </Button>
          </div>
        )}
      </div>

      <div className="h-full w-full p-8 flex flex-col justify-between z-20 border border-primary bg-primary">
        <PricingCard
          className="text-white z-20"
          title="Pro"
          price="$50 / month"
          features={[
            "Multi-agent monitoring",
            "Redacted telemetry by default",
            "Approval queue + auto-pause",
            "WhatsApp/SMS channels",
            "Limited audit exports",
            "Priority support",
          ]}
        />
        <div className="mt-4 z-20">
          <Link
            href={isTierPaid(workspaceTier) ? "/checkout/portal" : addWorkspaceToLink("/checkout?type=workspace&lookupKey=pro_monthly_2025_04")}
            className="w-full z-20"
          >
            <Button
              className="h-10 text-base bg-white/90 border-none text-primary hover:bg-white/70 w-full"
              variant="outline"
            >
              {isTierPaid(workspaceTier) ? "Manage billing" : "Upgrade to Pro"}
            </Button>
          </Link>
        </div>
      </div>

      <div className="p-8 border flex flex-col justify-between">
        <PricingCard
          className="text-secondary-foreground"
          title="Enterprise"
          price="Custom"
          features={[
            "Unlimited agents",
            "Full-fidelity telemetry (local or hybrid)",
            "Evidence bundles + audit exports",
            "Advanced approvals + RBAC",
            "Hybrid or self-hosted",
            "Dedicated support",
          ]}
        />
        <div className="mt-4">
          <Link href="mailto:support@clawops.ai?subject=Enterprise%20Inquiry">
            <Button variant="secondary" className="w-full h-10">
              Contact us
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
