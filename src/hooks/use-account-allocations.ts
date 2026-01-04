import {
  createAccountAllocation,
  deleteAccountAllocation,
  listAccountAllocations,
  updateAccountAllocation,
} from "@/commands/account-allocations";
import { toast } from "@/components/ui/use-toast";
import type { NewAccountAllocation, UpdateAccountAllocation } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ✅ desktop-only: tauri invoke (adjust import for your tauri version)
import { invoke } from "@tauri-apps/api/core";

export function useAccountAllocations(virtualAccountId: string) {
  const qc = useQueryClient();
  const allocationsKey = ["accountAllocations", virtualAccountId] as const;

  const allocationsQuery = useQuery({
    queryKey: allocationsKey,
    queryFn: () => listAccountAllocations(virtualAccountId),
    enabled: !!virtualAccountId,
  });

  const runRecalc = async () => {
    await invoke("recalculate_portfolio");
  };

  const createMutation = useMutation({
    mutationFn: (payload: NewAccountAllocation) => createAccountAllocation(payload),
    onSuccess: async () => {
      toast({ title: "Allocation added.", variant: "success" });

      // ✅ table updates immediately
      await qc.invalidateQueries({ queryKey: allocationsKey });

      // ✅ recompute snapshots + valuation history
      await runRecalc();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { allocationId: string; payload: UpdateAccountAllocation }) =>
      updateAccountAllocation(args.allocationId, args.payload),
    onSuccess: async () => {
      toast({ title: "Allocation updated.", variant: "success" });
      await qc.invalidateQueries({ queryKey: allocationsKey });
      await runRecalc();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (allocationId: string) => deleteAccountAllocation(allocationId),
    onSuccess: async () => {
      toast({ title: "Allocation deleted.", variant: "success" });
      await qc.invalidateQueries({ queryKey: allocationsKey });
      await runRecalc();
    },
  });

  return { allocationsQuery, createMutation, updateMutation, deleteMutation };
}
