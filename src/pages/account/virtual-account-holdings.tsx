import { getHoldings } from "@/commands/portfolio";
import { useAccounts } from "@/hooks/use-accounts";
import { useAccountAllocations } from "@/hooks/use-account-allocations";
import { useIsMobileViewport } from "@/hooks/use-platform";
import { QueryKeys } from "@/lib/query-keys";
import { Account, Holding, HoldingType } from "@/lib/types";
import { HoldingsTable } from "@/pages/holdings/components/holdings-table";
import { HoldingsTableMobile } from "@/pages/holdings/components/holdings-table-mobile";
import { Button, EmptyPlaceholder, Icons } from "@wealthfolio/ui";
import { useQueries } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

interface VirtualAccountHoldingsProps {
  virtualAccountId: string;
  showEmptyState?: boolean;
}

const VirtualAccountHoldings = ({
  virtualAccountId,
  showEmptyState = true,
}: VirtualAccountHoldingsProps) => {
  const isMobile = useIsMobileViewport();
  const navigate = useNavigate();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const { accounts } = useAccounts();
  const { allocationsQuery } = useAccountAllocations(virtualAccountId);

  const selectedAccount = useMemo(
    () => accounts?.find((a) => a.id === virtualAccountId) ?? null,
    [accounts, virtualAccountId],
  );

  const dummyAccounts = useMemo(
    () => (selectedAccount ? [selectedAccount] : []),
    [selectedAccount],
  );

  /** Active allocations only */
  const activeAllocations = useMemo(
    () => (allocationsQuery.data ?? []).filter((a) => !a.effectiveTo),
    [allocationsQuery.data],
  );

  /** Unique physical source accounts */
  const sourceAccountIds = useMemo(
    () => Array.from(new Set(activeAllocations.map((a) => a.sourceAccountId))),
    [activeAllocations],
  );

  /** Load holdings for each source account */
  const holdingsQueries = useQueries({
    queries: sourceAccountIds.map((accountId) => ({
      queryKey: [QueryKeys.HOLDINGS, accountId],
      queryFn: () => getHoldings(accountId),
      enabled: !!accountId && activeAllocations.length > 0,
    })),
  });

  const isLoading =
    allocationsQuery.isLoading || holdingsQueries.some((q) => q.isLoading);

  /** Build virtual holdings */
  const virtualHoldings: Holding[] = useMemo(() => {
    if (!activeAllocations.length) return [];

    const holdingsByAccount = new Map<string, Holding[]>();
    sourceAccountIds.forEach((id, i) => {
      holdingsByAccount.set(id, holdingsQueries[i]?.data ?? []);
    });

    const aggregated = new Map<string, Holding>();

    for (const alloc of activeAllocations) {
      const holdings = holdingsByAccount.get(alloc.sourceAccountId) ?? [];
      const holding = holdings.find((h) => h.instrument?.id === alloc.assetId);
      if (!holding || !holding.instrument?.id) continue;

      const instrumentId = holding.instrument.id;
      const totalQty = holding.quantity ?? 0;
      const totalBase = holding.marketValue?.base ?? 0;
      const totalLocal = holding.marketValue?.local ?? 0;
      const totalGainBase = holding.totalGain?.base ?? 0;
      const totalGainLocal = holding.totalGain?.local ?? 0;

      let qty = 0;
      let base = 0;
      let local = 0;
      let gainBase = 0;
      let gainLocal = 0;

      const p = alloc.allocationValue / 100;
      qty = totalQty * p;
      base = totalBase * p;
      local = totalLocal * p;
      gainBase = totalGainBase * p;
      gainLocal = totalGainLocal * p;

      const existing = aggregated.get(instrumentId);

      if (!existing) {
        aggregated.set(instrumentId, {
          ...holding,
          id: `virtual:${virtualAccountId}:${instrumentId}`,
          accountId: virtualAccountId,
          quantity: qty,
          marketValue: { base, local },
          totalGain: { base: gainBase , local: gainLocal },
          weight: 0,
        });
      } else {
        existing.quantity += qty;
        existing.marketValue = {
          base: (existing.marketValue?.base ?? 0) + base,
          local: (existing.marketValue?.local ?? 0) + local,
        };
        existing.totalGain = {
          base: (existing.totalGain?.base ?? 0) + gainBase,
          local: (existing.totalGain?.local ?? 0) + gainLocal,
        };
      }
    }

    const rows = Array.from(aggregated.values());

    /** Compute weights */
    const totalBase = rows.reduce((s, r) => s + r.marketValue.base, 0);
    if (totalBase > 0) {
      rows.forEach((r) => {
        r.weight = r.marketValue.base / totalBase;
      });
    }

    return rows;
  }, [activeAllocations, sourceAccountIds, holdingsQueries, virtualAccountId]);

  const filteredHoldings = virtualHoldings.filter(
    (h) => h.holdingType !== HoldingType.CASH,
  );

  /** Match AccountHoldings behavior */
  if (isLoading) return null;

  if (!filteredHoldings.length) {
    if (!showEmptyState) return null;

    return (
      <div className="flex items-center justify-center py-16">
        <EmptyPlaceholder
          icon={<Icons.TrendingUp className="h-10 w-10 text-muted-foreground" />}
          title="No virtual holdings yet"
          description="Add allocations from physical accounts to populate this virtual account."
        >
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button onClick={() => navigate(`/accounts/${virtualAccountId}/allocations`)}>
              <Icons.Plus className="mr-2 h-4 w-4" />
              Add Allocation
            </Button>
            <Button variant="outline" onClick={() => navigate(`/settings/accounts`)}>
              Manage Accounts
            </Button>
          </div>
        </EmptyPlaceholder>
      </div>
    );
  }

  const handleAccountChange = (_account: Account) => {};

  return (
    <div>
      <h3 className="py-4 text-lg font-bold">Holdings</h3>
      {isMobile ? (
        <HoldingsTableMobile
          holdings={filteredHoldings}
          isLoading={false}
          selectedTypes={selectedTypes}
          setSelectedTypes={setSelectedTypes}
          selectedAccount={selectedAccount}
          accounts={dummyAccounts}
          onAccountChange={handleAccountChange}
          showAccountFilter={false}
        />
      ) : (
        <HoldingsTable holdings={filteredHoldings} isLoading={false} />
      )}
    </div>
  );
};

export default VirtualAccountHoldings;
