"use client";

import { Edit, Trash2, Shield, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Shield as ShieldType, deleteShield } from "@/lib/actions/shields";
import { useToast } from "@/lib/hooks/use-toast";
import { categorizeShield, THREAT_CATEGORY_LABELS } from "@/lib/threat-protection/categories";

import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import ClientTimestampFormatter from "../client-timestamp-formatter";

interface ShieldListProps {
  shields: ShieldType[];
  categoryStats: Record<string, { count: number; lastTriggeredAt: string | null }>;
  onRefresh: () => void;
  onEdit: (shield: ShieldType) => void;
}

export default function ShieldList({ shields, categoryStats, onRefresh, onEdit }: ShieldListProps) {
  const { projectId } = useParams();
  const { toast } = useToast();
  const [deletingShieldId, setDeletingShieldId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const groupedShields = useMemo(() => {
    const grouped: Record<string, ShieldType[]> = {};
    shields.forEach((shield) => {
      const category = categorizeShield(shield);
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(shield);
    });
    return grouped;
  }, [shields]);

  const categoryOrder = ["jailbreaks", "data_exfiltration", "prompt_injection", "policy_manipulation", "other"];

  const handleDelete = async (shieldId: number) => {
    setIsDeleting(true);
    try {
      await deleteShield(projectId as string, shieldId);
      toast({
        title: "Protection rule deleted",
        description: "The protection rule has been successfully deleted.",
      });
      onRefresh();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete protection rule",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeletingShieldId(null);
    }
  };

  if (shields.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">No threat protection rules yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first protection rule to get started</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {categoryOrder
          .filter((category) => groupedShields[category]?.length)
          .map((category) => {
            const stats = categoryStats[category] ?? { count: 0, lastTriggeredAt: null };
            return (
            <div key={category} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {THREAT_CATEGORY_LABELS[category as keyof typeof THREAT_CATEGORY_LABELS]}
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>
                    Trigger count: <span className="text-foreground">{stats.count}</span>
                  </span>
                  <span>
                    Last triggered:{" "}
                    <span className="text-foreground">
                      {stats.lastTriggeredAt ? (
                        <ClientTimestampFormatter timestamp={String(stats.lastTriggeredAt)} />
                      ) : (
                        "Not yet"
                      )}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {groupedShields[category].map((shield) => (
                  <Card key={shield.id} className="hover:bg-accent/50 transition-colors">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <CardTitle className="text-lg">{shield.name}</CardTitle>
                            {shield.is_active ? (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs">{shield.shield_key}</span>
                            {shield.description && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span>{shield.description}</span>
                              </>
                            )}
                          </CardDescription>
                          {shield.prompt_description && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              <p className="line-clamp-2">{shield.prompt_description}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(shield)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingShieldId(shield.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </div>
          );
          })}
      </div>

      <AlertDialog open={deletingShieldId !== null} onOpenChange={(open) => !open && setDeletingShieldId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Protection Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this protection rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingShieldId && handleDelete(deletingShieldId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

