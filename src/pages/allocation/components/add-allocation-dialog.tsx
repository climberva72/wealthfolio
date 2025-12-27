import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { useHoldings } from "@/hooks/use-holdings";
import { useEffect, useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

import type { Account } from "@/lib/types"; // adjust if your Account type lives elsewhere
import type { AllocationType, NewAccountAllocation } from "@/lib/types";

const schema = z.object({
  sourceAccountId: z.string().min(1),
  assetId: z.string().min(1),
  allocationType: z.enum(["percent", "units", "value"]),
  allocationValue: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof schema>;

const allocationTypeOptions: ResponsiveSelectOption[] = [
  { label: "Percent", value: "percent" },
  { label: "Units", value: "units" },
  { label: "Value", value: "value" },
];

export function AddAllocationDialog(props: {
  virtualAccountId: string;
  sourceAccounts: Account[];
  onCreate: (payload: NewAccountAllocation) => void;
  isSubmitting?: boolean;
}) {
  const { virtualAccountId, sourceAccounts, onCreate, isSubmitting } = props;

  const sourceOptions: ResponsiveSelectOption[] = sourceAccounts.map((a) => ({
    label: a.name,
    value: a.id,
  }));

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      allocationType: "percent",
      allocationValue: 0,
    },
  });

  const submit = (v: FormValues) => {
    const payload: NewAccountAllocation = {
      virtualAccountId,
      sourceAccountId: v.sourceAccountId,
      assetId: v.assetId,
      allocationType: v.allocationType as AllocationType,
      allocationValue: v.allocationValue,
      effectiveFrom: new Date().toISOString(),
      effectiveTo: null,
    };
    onCreate(payload);
  };

  const sourceAccountId = form.watch("sourceAccountId");
  const { holdings, isLoading: isHoldingsLoading } = useHoldings(sourceAccountId);

  const assetOptions: ResponsiveSelectOption[] = useMemo(() => {
    if (!holdings) return [];

    const seen = new Set<string>();

    return holdings
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

        return {
          label,
          value: instr.id, // ✅ string asset_id sent to Rust
        };
      });
  }, [holdings]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Add Allocation</Button>
      </DialogTrigger>
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
              name="allocationType"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Allocation Type</FormLabel>
                  <FormControl>
                    <ResponsiveSelect
                      value={field.value}
                      onValueChange={field.onChange}
                      options={allocationTypeOptions}
                      placeholder="Select allocation type"
                      sheetTitle="Select Allocation Type"
                      sheetDescription="Percent scales automatically; Units/Value are fixed."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allocationValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" {...field} />
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
