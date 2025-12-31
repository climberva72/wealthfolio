import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import {
  createAccountAllocation,
  listAccountAllocations,
  deleteAccountAllocation,
  updateAccountAllocation, // ✅ add this
} from "@/commands/account-allocations";
import type { NewAccountAllocation, UpdateAccountAllocation } from "@/lib/types";

export function useAccountAllocations(virtualAccountId: string) {
  const qc = useQueryClient();

  // ✅ define once and reuse everywhere
  const queryKey = ["accountAllocations", virtualAccountId] as const;

  const allocationsQuery = useQuery({
    queryKey,
    queryFn: () => listAccountAllocations(virtualAccountId),
    enabled: !!virtualAccountId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: NewAccountAllocation) => createAccountAllocation(payload),
    onSuccess: () => {
      toast({ title: "Allocation added.", variant: "success" });
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: unknown) => {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e, null, 2);

      console.error("createAccountAllocation failed:", e);

      toast({
        title: "Uh oh! Something went wrong adding this allocation.",
        description: message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (args: { allocationId: string; payload: UpdateAccountAllocation }) =>
      updateAccountAllocation(args.allocationId, args.payload),
    onSuccess: () => {
      toast({ title: "Allocation updated.", variant: "success" });
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      toast({
        title: "Failed to update allocation.",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (allocationId: string) => deleteAccountAllocation(allocationId),
    onSuccess: () => {
      toast({ title: "Allocation deleted.", variant: "success" });
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: unknown) => {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      toast({
        title: "Failed to delete allocation.",
        description: msg,
        variant: "destructive",
      });
    },
  });

  return { allocationsQuery, createMutation, updateMutation, deleteMutation };
}
