import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type {
  Account,
  AccountAllocation,
  UpdateAccountAllocation,
} from "@/lib/types";

// ---- helpers: ISO <-> date input (YYYY-MM-DD) ----
function isoToDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Use UTC date portion to avoid timezone shifting
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToIso(dateStr: string): string {
  // Interpret the user's chosen day as midnight UTC to avoid TZ drift
  // "2025-12-27" -> "2025-12-27T00:00:00.000Z"
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

export function EditAllocationDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocation: AccountAllocation | null;
  virtualAccountId: string;
  sourceAccounts: Account[];
  onUpdate: (allocationId: string, changes: UpdateAccountAllocation) => void;
  isSubmitting?: boolean;
}) {
  const { open, onOpenChange, allocation, sourceAccounts, onUpdate, isSubmitting } =
    props;

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
      effectiveFrom: "",
    },
  });

  // Reset values when opening / allocation changes
  useEffect(() => {
    if (!open) return;

    form.reset({
      sourceAccountId: allocation?.sourceAccountId ?? "",
      assetId: allocation?.assetId ?? "",
      percent: allocation ? Number(allocation.allocationValue) : 100,
      effectiveFrom: isoToDateInput(allocation?.effectiveFrom),
    });
  }, [open, allocation, form]);

  const sourceAccountId = form.watch("sourceAccountId");
  const { holdings, isLoading: isHoldingsLoading } = useHoldings(sourceAccountId);

  const assetOptions: ResponsiveSelectOption[] = useMemo(() => {
    const opts: ResponsiveSelectOption[] = [];

    // Ensure current asset is selectable even before holdings load
    if (allocation?.assetId) {
      opts.push({ label: allocation.assetId, value: allocation.assetId });
    }

    if (!holdings) return opts;

    const seen = new Set<string>(opts.map((o) => String(o.value)));

    const fromHoldings = holdings
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
          : instr.name ?? instr.id;

        return { label, value: instr.id };
      });

    return [...opts, ...fromHoldings];
  }, [holdings, allocation?.assetId]);

  const submit = (v: FormValues) => {
    if (!allocation) return;

    const changes: UpdateAccountAllocation = {
      sourceAccountId: v.sourceAccountId,
      assetId: v.assetId,
      allocationType: "percent",
      allocationValue: v.percent,
      effectiveFrom: dateInputToIso(v.effectiveFrom), // ✅ now editable
      effectiveTo: allocation.effectiveTo ?? null,
    };

    onUpdate(allocation.id, changes);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Allocation</DialogTitle>
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
                      onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue("assetId", ""); // clear only when source changes
                      }}
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

            {/* ✅ NEW: Effective From */}
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

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={!!isSubmitting}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={!!isSubmitting || !allocation}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
