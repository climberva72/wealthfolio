import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";
import { createAccountAllocation, listAccountAllocations, deleteAccountAllocation } from "@/commands/account-allocations";
import type { NewAccountAllocation } from "@/lib/types";

export function useAccountAllocations(virtualAccountId: string) {
  const qc = useQueryClient();

  const allocationsQuery = useQuery({
    queryKey: ["accountAllocations", virtualAccountId],
    queryFn: () => listAccountAllocations(virtualAccountId),
    enabled: !!virtualAccountId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: NewAccountAllocation) => createAccountAllocation(payload),
    onSuccess: () => {
      toast({ title: "Allocation added.", variant: "success" });
      qc.invalidateQueries({ queryKey: ["accountAllocations", virtualAccountId] });
    },
    // onError: () => {
    //   toast({
    //     title: "Uh oh! Something went wrong adding this allocation.",
    //     description: "Please try again or report an issue if the problem persists.",
    //     variant: "destructive",
    //   });
    // },
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

  const deleteMutation = useMutation({
    mutationFn: (allocationId: string) => deleteAccountAllocation(allocationId),
    onSuccess: () => {
      toast({ title: "Allocation deleted.", variant: "success" });
      qc.invalidateQueries({ queryKey: ["accountAllocations", virtualAccountId] });
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

  return { allocationsQuery, createMutation, deleteMutation };
}
