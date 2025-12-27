import { useMemo } from "react";

import { getAccounts } from "@/commands/account"; // adjust: whatever you use to fetch accounts
import { Button } from "@/components/ui/button";
import { useAccountAllocations } from "@/hooks/use-account-allocations";
import { QueryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { AddAllocationDialog } from "./components/add-allocation-dialog";

export default function AccountAllocationsPage() {
  //const { accountId } = useParams() as { accountId: string };

  let accountId = "6dc1d65b-7d75-4bf3-8578-6f16613acd79";

  const accountsQuery = useQuery({
    queryKey: [QueryKeys.ACCOUNTS],
    queryFn: getAccounts, // or whatever your existing function is
  });

  const account = accountsQuery.data?.find((a) => a.id === accountId);

  const { allocationsQuery, createMutation, deleteMutation } = useAccountAllocations(accountId);

  const sourceAccounts = useMemo(
    () => (accountsQuery.data ?? []).filter((a) => !a.isVirtual),
    [accountsQuery.data],
  );

  if (!account) return null;

  if (!account.isVirtual) {
    return <div className="p-4">Allocations are only available for virtual accounts.</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Allocations</h2>
        <AddAllocationDialog
          virtualAccountId={accountId}
          sourceAccounts={sourceAccounts}
          onCreate={(payload) => createMutation.mutate(payload)}
          isSubmitting={createMutation.isPending}
        />
      </div>

      {allocationsQuery.isLoading ? (
        <div>Loading...</div>
      ) : allocationsQuery.isError ? (
        <div className="p-4 text-red-600">
          Failed to load allocations.
          <pre className="mt-2 text-xs whitespace-pre-wrap text-red-700">
            {(() => {
              const e = allocationsQuery.error as any;
              return e?.message ?? JSON.stringify(e, null, 2);
            })()}
          </pre>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Source</th>
                <th className="p-2 text-left">Asset</th>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-right">Value</th>
                <th className="p-2 text-left">From</th>
                <th className="p-2 text-left">To</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(allocationsQuery.data ?? []).map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="p-2">
                    {sourceAccounts.find((s) => s.id === a.sourceAccountId)?.name ??
                      a.sourceAccountId}
                  </td>
                  <td className="p-2">{a.assetId}</td>
                  <td className="p-2">{a.allocationType}</td>
                  <td className="p-2 text-right">{a.allocationValue}</td>
                  <td className="p-2">{a.effectiveFrom}</td>
                  <td className="p-2">{a.effectiveTo ?? ""}</td>
                  <td className="p-2 text-right">
                    <Button
                      variant="outline"
                      onClick={() => {
                        deleteMutation.mutate(a.id);
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
