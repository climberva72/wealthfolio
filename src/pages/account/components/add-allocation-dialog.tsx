import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ResponsiveSelect, type ResponsiveSelectOption } from "@wealthfolio/ui";

import { useHoldings } from "@/hooks/use-holdings";
import type { Account, NewAccountAllocation } from "@/lib/types";

// ---- helpers: ISO <-> date input (YYYY-MM-DD) ----
function todayDateInput(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToIso(dateStr: string): string {
  // Interpret the chosen day as midnight UTC to avoid TZ drift
  return new Date(`${dateStr}T00:00:00.000Z`).toISOString();
}

const schema = z.object({
  sourceAccountId: z.string().min(1, "Select a source account"),
  assetId: z.string().min(1, "Select an asset"),
  percent: z.coerce
    .number()
    .min(0, "Must be between 0 and 100")
    .max(100, "Must be between 0 and 100"),
  effectiveFrom: z
    .string()
    .min(1, "Select a start date")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
});

type FormValues = z.infer<typeof schema>;

export function AddAllocationDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  virtualAccountId: string;
  sourceAccounts: Account[];
  onCreate: (payload: NewAccountAllocation) => void;
  isSubmitting?: boolean;
}) {
  const { open, onOpenChange, virtualAccountId, sourceAccounts, onCreate, isSubmitting } = props;

  const sourceOptions: ResponsiveSelectOption[] = useMemo(
    () =>
      sourceAccounts.map((a) => ({
        label: a.name,
        value: a.id,
      })),
    [sourceAccounts],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      sourceAccountId: "",
      assetId: "",
      percent: 100,
      effectiveFrom: todayDateInput(),
    },
  });

  const sourceAccountId = form.watch("sourceAccountId");
  const { holdings, isLoading: isHoldingsLoading } = useHoldings(sourceAccountId);

  // Clear asset when source changes (avoid stale selection)
  useEffect(() => {
    form.setValue("assetId", "");
  }, [sourceAccountId, form]);

  const assetOptions: ResponsiveSelectOption[] = useMemo(() => {
    if (!holdings) return [];

    const seen = new Set<string>();

    const options = holdings
      .filter((h) => h.instrument?.id)
      .filter((h) => {
        const id = h.instrument!.id;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map((h) => {
        const instr = h.instrument!;
        const label = instr.symbol
          ? `${instr.symbol}${instr.name ? ` — ${instr.name}` : ""}`
          : (instr.name ?? instr.id);

        return { label, value: instr.id };
      });

    // Add CASH as a special synthetic “asset”
    // (assume base currency, handled specially in backend snapshot calc)
    options.unshift({ label: "Cash", value: "CASH" });

    return options;
  }, [holdings]);

  // When opened, reset to clean defaults (nice UX when opening from "+" repeatedly)
  useEffect(() => {
    if (!open) return;
    form.reset({
      sourceAccountId: "",
      assetId: "",
      percent: 100,
      effectiveFrom: todayDateInput(),
    });
  }, [open, form]);

  const submit = (v: FormValues) => {
    const payload: NewAccountAllocation = {
      virtualAccountId,
      sourceAccountId: v.sourceAccountId,
      assetId: v.assetId,
      allocationType: "percent",
      allocationValue: v.percent,
      effectiveFrom: dateInputToIso(v.effectiveFrom),
      effectiveTo: null,
    };

    onCreate(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Allocation</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-6">
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Source Account</FormLabel>
                  <FormControl>
                    <ResponsiveSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      options={sourceOptions}
                      placeholder="Select source account"
                      sheetTitle="Select Source Account"
                      sheetDescription="Choose the physical account that holds the asset."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assetId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Asset</FormLabel>
                  <FormControl>
                    <ResponsiveSelect
                      value={field.value}
                      onValueChange={(val) => field.onChange(String(val))}
                      options={assetOptions}
                      disabled={!sourceAccountId}
                      placeholder={
                        !sourceAccountId
                          ? "Select a source account first"
                          : isHoldingsLoading
                            ? "Loading assets..."
                            : "Select asset"
                      }
                      sheetTitle="Select Asset"
                      sheetDescription="Choose the asset held in the source account."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Percent (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" min={0} max={100} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="effectiveFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>From</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={!!isSubmitting}>
              {isSubmitting ? "Adding..." : "Add"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
