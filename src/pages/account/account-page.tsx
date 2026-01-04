import { getHoldings } from "@/commands/portfolio";
import { HistoryChart } from "@/components/history-chart";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  GainAmount,
  GainPercent,
  IntervalSelector,
  Page,
  PageContent,
  PageHeader,
  PrivacyAmount,
} from "@wealthfolio/ui";
import { useMemo, useState } from "react";

import { MobileActionsMenu } from "@/components/mobile-actions-menu";
import { PrivacyToggle } from "@/components/privacy-toggle";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAccounts } from "@/hooks/use-accounts";
import { useValuationHistory } from "@/hooks/use-valuation-history";
import { AccountType } from "@/lib/constants";
import { QueryKeys } from "@/lib/query-keys";
import {
  Account,
  AccountValuation,
  DateRange,
  Holding,
  TimePeriod,
  TrackedItem,
  type AccountAllocation,
} from "@/lib/types";
import { calculatePerformanceMetrics, cn } from "@/lib/utils";
import { PortfolioUpdateTrigger } from "@/pages/dashboard/portfolio-update-trigger";
import { useCalculatePerformanceHistory } from "@/pages/performance/hooks/use-performance-data";
import { useQuery } from "@tanstack/react-query";
import { Icons, type Icon } from "@wealthfolio/ui";
import { subMonths } from "date-fns";
import { useNavigate, useParams } from "react-router-dom";
import { AccountContributionLimit } from "./account-contribution-limit";
import AccountHoldings from "./account-holdings";
import AccountMetrics from "./account-metrics";
import VirtualAccountHoldings from "./virtual-account-holdings";

// ✅ allocations table + dialogs
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAccountAllocations } from "@/hooks/use-account-allocations";
import { AddAllocationDialog } from "./components/add-allocation-dialog";
import { AllocationsTable } from "./components/allocations-table";
import { EditAllocationDialog } from "./components/edit-allocation-dialog";

interface HistoryChartData {
  date: string;
  totalValue: number;
  netContribution: number;
  currency: string;
}

// Map account types to icons for visual distinction
const accountTypeIcons: Record<AccountType, Icon> = {
  SECURITIES: Icons.Briefcase,
  CASH: Icons.DollarSign,
  CRYPTOCURRENCY: Icons.Bitcoin,
};

// Helper function to get the initial date range (copied from dashboard)
const getInitialDateRange = (): DateRange => ({
  from: subMonths(new Date(), 3),
  to: new Date(),
});

// Define the initial interval code (consistent with other pages)
const INITIAL_INTERVAL_CODE: TimePeriod = "3M";

const AccountPage = () => {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getInitialDateRange());
  const [selectedIntervalCode, setSelectedIntervalCode] =
    useState<TimePeriod>(INITIAL_INTERVAL_CODE);
  const [desktopSelectorOpen, setDesktopSelectorOpen] = useState(false);
  const [mobileSelectorOpen, setMobileSelectorOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { accounts, isLoading: isAccountsLoading } = useAccounts();
  const account = useMemo(() => accounts?.find((acc) => acc.id === id), [accounts, id]);

  // ✅ allocations hook (safe even for physical accounts; your hook should gate internally via enabled)
  const { allocationsQuery, createMutation, updateMutation, deleteMutation } =
    useAccountAllocations(id);

  const sourceAccounts = useMemo(() => accounts.filter((a) => !a.isVirtual), [accounts]);

  const sourceNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of sourceAccounts) m.set(a.id, a.name);
    return m;
  }, [sourceAccounts]);

  // --- allocations UI state for edit/delete ---
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AccountAllocation | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<AccountAllocation | null>(null);

  // Query holdings to check if account has any assets (only for physical accounts)
  const { data: holdings, isLoading: isHoldingsLoading } = useQuery<Holding[], Error>({
    queryKey: [QueryKeys.HOLDINGS, id],
    queryFn: () => getHoldings(id),
    enabled: !!id && !!account && !account.isVirtual, // ✅ only physical accounts
  });

  const allocationRows = allocationsQuery.data ?? [];

  const hasHoldings = useMemo(() => {
    if (!account) return false;

    if (account.isVirtual) {
      return allocationRows.length > 0;
    }

    return !!holdings && holdings.length > 0;
  }, [account, holdings, allocationRows.length]);

  // Group accounts by type for the selector
  const accountsByType = useMemo(() => {
    const grouped: Record<string, Account[]> = {};
    accounts.forEach((acc) => {
      if (!grouped[acc.accountType]) grouped[acc.accountType] = [];
      grouped[acc.accountType].push(acc);
    });
    return Object.entries(grouped);
  }, [accounts]);

  const accountTrackedItem: TrackedItem | undefined = useMemo(() => {
    if (account) return { id: account.id, type: "account", name: account.name };
    return undefined;
  }, [account]);

  const { data: performanceResponse, isLoading: isPerformanceHistoryLoading } =
    useCalculatePerformanceHistory({
      selectedItems: accountTrackedItem ? [accountTrackedItem] : [],
      dateRange: dateRange,
    });

  const accountPerformance = performanceResponse?.[0] || null;

  const { valuationHistory, isLoading: isValuationHistoryLoading } = useValuationHistory(
    dateRange,
    id,
  );

  // Calculate gainLossAmount and simpleReturn from valuationHistory
  const { gainLossAmount: frontendGainLossAmount, simpleReturn: frontendSimpleReturn } =
    useMemo(() => {
      return calculatePerformanceMetrics(valuationHistory, false);
    }, [valuationHistory, id]);

  const chartData: HistoryChartData[] = useMemo(() => {
    if (!valuationHistory) return [];
    return valuationHistory.map((valuation: AccountValuation) => ({
      date: valuation.valuationDate,
      totalValue: valuation.totalValue,
      netContribution: valuation.netContribution,
      currency: valuation.accountCurrency,
    }));
  }, [valuationHistory]);

  const currentValuation = valuationHistory?.[valuationHistory.length - 1];

  const isLoading = isAccountsLoading || isValuationHistoryLoading;
  const isDetailsLoading = isLoading || isPerformanceHistoryLoading;

  // Callback for IntervalSelector
  const handleIntervalSelect = (
    code: TimePeriod,
    _description: string,
    range: DateRange | undefined,
  ) => {
    setSelectedIntervalCode(code);
    setDateRange(range);
  };

  const percentageToDisplay = useMemo(() => {
    if (selectedIntervalCode === "ALL") return frontendSimpleReturn;
    if (accountPerformance) return accountPerformance.cumulativeMwr ?? 0;
    return 0;
  }, [accountPerformance, selectedIntervalCode, frontendSimpleReturn]);

  const handleAccountSwitch = (selectedAccount: Account) => {
    navigate(`/accounts/${selectedAccount.id}`);
    setDesktopSelectorOpen(false);
    setMobileSelectorOpen(false);
  };

  return (
    <Page>
      <PageHeader
        onBack={() => navigate(-1)}
        actions={
          <>
            <div className="hidden items-center gap-2 sm:flex">
              {!account?.isVirtual && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate(`/import?account=${id}`)}
                  title="Import CSV"
                >
                  <Icons.Import className="h-4 w-4" />
                </Button>
              )}

              <Button
                variant="outline"
                size="icon"
                title={account?.isVirtual ? "Add Allocation" : "Record Transaction"}
                onClick={() => {
                  if (account?.isVirtual) setAddOpen(true);
                  else navigate(`/activities/manage?account=${id}`);
                }}
              >
                <Icons.Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="sm:hidden">
              <MobileActionsMenu
                open={mobileActionsOpen}
                onOpenChange={setMobileActionsOpen}
                title="Account Actions"
                description="Manage this account"
                actions={[
                  ...(!account?.isVirtual
                    ? ([
                        {
                          icon: "Import",
                          label: "Import CSV",
                          description: "Import transactions from file",
                          onClick: () => navigate(`/import?account=${id}`),
                        },
                      ] as const)
                    : []),

                  {
                    icon: "Plus",
                    label: account?.isVirtual ? "Add Allocation" : "Record Transaction",
                    description: account?.isVirtual
                      ? "Add a source allocation to this virtual account"
                      : "Add a new activity manually",
                    onClick: () => {
                      if (account?.isVirtual) setAddOpen(true);
                      else navigate(`/activities/manage?account=${id}`);
                    },
                  } as const,
                ]}
              />
            </div>
          </>
        }
      >
        <div className="flex flex-col" data-tauri-drag-region="true">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold md:text-xl">{account?.name ?? "Account"}</h1>

            {/* Desktop account selector */}
            <div className="hidden sm:block">
              <Popover open={desktopSelectorOpen} onOpenChange={setDesktopSelectorOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    aria-label="Switch account"
                  >
                    <Icons.ChevronDown className="text-muted-foreground size-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search accounts..." />
                    <CommandList>
                      <CommandEmpty>No accounts found.</CommandEmpty>
                      {accountsByType.map(([type, typeAccounts]) => (
                        <CommandGroup key={type} heading={type}>
                          {typeAccounts.map((acc) => {
                            const IconComponent =
                              accountTypeIcons[acc.accountType] ?? Icons.CreditCard;
                            return (
                              <CommandItem
                                key={acc.id}
                                value={`${acc.name} ${acc.currency}`}
                                onSelect={() => handleAccountSwitch(acc)}
                                className="flex items-center py-1.5"
                              >
                                <IconComponent className="mr-2 h-4 w-4" />
                                <span>
                                  {acc.name} ({acc.currency})
                                </span>
                                <Icons.Check
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    account?.id === acc.id ? "opacity-100" : "opacity-0",
                                  )}
                                />
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Mobile account selector */}
            <div className="block sm:hidden">
              <Sheet open={mobileSelectorOpen} onOpenChange={setMobileSelectorOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    aria-label="Switch account"
                  >
                    <Icons.ChevronDown className="text-muted-foreground h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="mx-1 h-[80vh] rounded-t-4xl p-0">
                  <SheetHeader className="border-border border-b px-6 py-4">
                    <SheetTitle>Switch Account</SheetTitle>
                    <SheetDescription>Choose an account to view</SheetDescription>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(80vh-5rem)] px-6 py-4">
                    <div className="space-y-6">
                      {accountsByType.map(([type, typeAccounts]) => (
                        <div key={type}>
                          <h3 className="text-muted-foreground mb-3 text-sm font-medium">{type}</h3>
                          <div className="space-y-2">
                            {typeAccounts.map((acc) => {
                              const IconComponent =
                                accountTypeIcons[acc.accountType] ?? Icons.CreditCard;
                              return (
                                <button
                                  key={acc.id}
                                  onClick={() => handleAccountSwitch(acc)}
                                  className={cn(
                                    "hover:bg-accent active:bg-accent/80 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors focus:outline-none",
                                    account?.id === acc.id
                                      ? "border-primary bg-accent"
                                      : "border-transparent",
                                  )}
                                >
                                  <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                                    <IconComponent className="text-primary h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-foreground truncate font-medium">
                                      {acc.name}
                                    </div>
                                    <div className="text-muted-foreground text-sm">
                                      {acc.currency}
                                    </div>
                                  </div>
                                  {account?.id === acc.id && (
                                    <Icons.Check className="text-primary h-5 w-5 flex-shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <p className="text-muted-foreground text-sm md:text-base">
            {account?.group ?? account?.currency}
          </p>
        </div>
      </PageHeader>

      <PageContent>
        {hasHoldings && !isHoldingsLoading ? (
          <>
            <div className="grid grid-cols-1 gap-4 pt-0 md:grid-cols-3">
              <Card className="col-span-1 md:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-md">
                    <PortfolioUpdateTrigger lastCalculatedAt={currentValuation?.calculatedAt}>
                      <div className="flex items-start gap-2">
                        <div>
                          <p className="pt-3 text-xl font-bold">
                            <PrivacyAmount
                              value={currentValuation?.totalValue ?? 0}
                              currency={account?.currency ?? "USD"}
                            />
                          </p>
                          <div className="flex space-x-3 text-sm">
                            <GainAmount
                              className="text-sm font-light"
                              value={frontendGainLossAmount}
                              currency={account?.currency ?? "USD"}
                              displayCurrency={false}
                            />
                            <div className="border-muted-foreground my-1 border-r pr-2" />
                            <GainPercent
                              className="text-sm font-light"
                              value={percentageToDisplay}
                              animated={true}
                            />
                          </div>
                        </div>
                        <PrivacyToggle className="mt-3" />
                      </div>
                    </PortfolioUpdateTrigger>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="w-full p-0">
                    <div className="flex w-full flex-col">
                      <div className="h-[480px] w-full">
                        <HistoryChart data={chartData} isLoading={false} />
                        <IntervalSelector
                          className="relative right-0 bottom-10 left-0 z-10"
                          onIntervalSelect={handleIntervalSelect}
                          isLoading={isValuationHistoryLoading}
                          initialSelection={INITIAL_INTERVAL_CODE}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col space-y-4">
                <AccountMetrics
                  valuation={currentValuation}
                  performance={accountPerformance}
                  className="grow"
                  isLoading={isDetailsLoading || isPerformanceHistoryLoading}
                />
                {!account?.isVirtual && <AccountContributionLimit accountId={id} />}
              </div>
            </div>

            {account?.isVirtual ? (
              <VirtualAccountHoldings virtualAccountId={id} />
            ) : (
              <AccountHoldings accountId={id} />
            )}

            {account?.isVirtual ? (
              <section className="mt-4">
                <div className="mb-2 flex flex-row items-center justify-between">
                  <h2 className="text-md font-semibold">Allocations</h2>
                </div>

                <AddAllocationDialog
                  open={addOpen}
                  onOpenChange={setAddOpen}
                  virtualAccountId={id}
                  sourceAccounts={sourceAccounts}
                  onCreate={(payload) => createMutation.mutate(payload)}
                  isSubmitting={createMutation.isPending}
                />

                <AllocationsTable
                  allocations={allocationRows}
                  isLoading={allocationsQuery.isLoading}
                  sourceNameById={sourceNameById}
                  onEdit={(a) => {
                    setEditing(a);
                    setEditOpen(true);
                  }}
                  onDelete={(a) => {
                    setDeleting(a);
                    setDeleteOpen(true);
                  }}
                />

                {/* ---------------- Edit Dialog ---------------- */}
                <EditAllocationDialog
                  open={editOpen}
                  onOpenChange={(o) => {
                    setEditOpen(o);
                    if (!o) setEditing(null);
                  }}
                  allocation={editing}
                  virtualAccountId={id}
                  sourceAccounts={sourceAccounts}
                  isSubmitting={updateMutation.isPending}
                  onUpdate={(allocationId, payload) =>
                    updateMutation.mutate({ allocationId, payload })
                  }
                />

                {/* ---------------- Delete Confirm ---------------- */}
                <AlertDialog
                  open={deleteOpen}
                  onOpenChange={(o) => {
                    setDeleteOpen(o);
                    if (!o) setDeleting(null);
                  }}
                >
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete allocation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the allocation from the virtual account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (!deleting) return;
                          deleteMutation.mutate(deleting.id);
                          setDeleteOpen(false);
                          setDeleting(null);
                        }}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </section>
            ) : null}
          </>
        ) : account?.isVirtual ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-full">
              {/* keep the dialog mounted so the button can open it */}
              <AddAllocationDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                virtualAccountId={id}
                sourceAccounts={sourceAccounts}
                onCreate={(payload) => createMutation.mutate(payload)}
                isSubmitting={createMutation.isPending}
              />

              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-muted-foreground mb-3">
                  <Icons.Blocks className="h-10 w-10" />
                </div>
                <h3 className="text-base font-semibold">No allocations yet</h3>
                <p className="text-muted-foreground mt-1 max-w-md text-sm">
                  Get started by adding a source allocation to build this virtual account.
                </p>

                <div className="mt-5">
                  <Button onClick={() => setAddOpen(true)}>
                    <Icons.Plus className="mr-2 h-4 w-4" />
                    Add Allocation
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <AccountHoldings accountId={id} showEmptyState={true} />
        )}
      </PageContent>
    </Page>
  );
};

export default AccountPage;
