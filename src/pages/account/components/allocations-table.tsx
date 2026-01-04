import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { Icons } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountAllocation } from "@/lib/types";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

type AllocationsTableProps = {
  allocations: AccountAllocation[];
  isLoading: boolean;
  sourceNameById: Map<string, string>;
  onEdit: (a: AccountAllocation) => void;
  onDelete: (a: AccountAllocation) => void;
};

export function AllocationsTable({
  allocations,
  isLoading,
  sourceNameById,
  onEdit,
  onDelete,
}: AllocationsTableProps) {
  const columns = useMemo(
    () => getColumns({ sourceNameById, onEdit, onDelete }),
    [sourceNameById, onEdit, onDelete],
  );

  if (isLoading) {
    // match HoldingsTable skeleton style
    return (
      <div className="space-y-4 pt-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  // simple filters (optional) - matches holdings pattern
  const uniqueTypesSet = new Set<string>();
  const typeOptions = allocations.reduce((acc, a) => {
    const t = a.allocationType;
    if (t && !uniqueTypesSet.has(t)) {
      uniqueTypesSet.add(t);
      acc.push({ label: t.toUpperCase(), value: t });
    }
    return acc;
  }, [] as { label: string; value: string }[]);

  const filters =
    typeOptions.length > 1
      ? [
          {
            id: "allocationType",
            title: "Type",
            options: typeOptions,
          },
        ]
      : [];

  return (
    <div className="flex h-full flex-col">
      <div className="bg-background">
        <DataTable
          data={allocations}
          columns={columns}
          searchBy="source" // uses our "source" column id below
          filters={filters}
          showColumnToggle={true}
          storageKey="allocations-table"
          defaultColumnVisibility={{
            allocationType: false,
            sourceId: false,
            assetId: true, // keep visible by default
          }}
          defaultSorting={[{ id: "from", desc: true }]}
          scrollable={true}
        />
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

const getColumns = ({
  sourceNameById,
  onEdit,
  onDelete,
}: {
  sourceNameById: Map<string, string>;
  onEdit: (a: AccountAllocation) => void;
  onDelete: (a: AccountAllocation) => void;
}): ColumnDef<AccountAllocation>[] => [
  {
    id: "source",
    accessorFn: (row) => sourceNameById.get(row.sourceAccountId) ?? row.sourceAccountId,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Source" />,
    meta: { label: "Source" },
    cell: ({ row }) => {
      const a = row.original;
      const name = sourceNameById.get(a.sourceAccountId) ?? a.sourceAccountId;

      return (
        <div className="flex min-h-[40px] flex-col justify-center px-4">
          <span className="font-medium">{name}</span>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a = sourceNameById.get(rowA.original.sourceAccountId) ?? rowA.original.sourceAccountId;
      const b = sourceNameById.get(rowB.original.sourceAccountId) ?? rowB.original.sourceAccountId;
      return a.localeCompare(b);
    },
    filterFn: (row, _columnId, filterValue) => {
      const a = row.original;
      const searchTerm = String(filterValue ?? "").toLowerCase();
      const name = (sourceNameById.get(a.sourceAccountId) ?? a.sourceAccountId).toLowerCase();
      return (
        name.includes(searchTerm) ||
        a.sourceAccountId.toLowerCase().includes(searchTerm) ||
        a.assetId.toLowerCase().includes(searchTerm)
      );
    },
    enableHiding: false,
  },
  {
    id: "assetId",
    accessorKey: "assetId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Asset" />,
    meta: { label: "Asset" },
    cell: ({ row }) => (
      <div className="flex min-h-[40px] flex-col justify-center px-4">
        <span className="font-medium">{row.original.assetId}</span>
        <span className="text-muted-foreground text-xs">{row.original.allocationType}</span>
      </div>
    ),
    sortingFn: (rowA, rowB) => rowA.original.assetId.localeCompare(rowB.original.assetId),
  },
  {
    id: "value",
    accessorFn: (row) => {
      const n = typeof row.allocationValue === "number" ? row.allocationValue : Number(row.allocationValue);
      return Number.isFinite(n) ? n : 0;
    },
    header: ({ column }) => (
      <DataTableColumnHeader className="justify-end text-right" column={column} title="Value" />
    ),
    meta: { label: "Value" },
    cell: ({ row }) => {
      const n =
        typeof row.original.allocationValue === "number"
          ? row.original.allocationValue
          : Number(row.original.allocationValue);

      const display = Number.isFinite(n) ? n : 0;

      return (
        <div className="flex min-h-[40px] flex-col items-end justify-center px-4">
          <div className="font-medium tabular-nums">{display}%</div>
        </div>
      );
    },
    sortingFn: (rowA, rowB) => {
      const a =
        typeof rowA.original.allocationValue === "number"
          ? rowA.original.allocationValue
          : Number(rowA.original.allocationValue);
      const b =
        typeof rowB.original.allocationValue === "number"
          ? rowB.original.allocationValue
          : Number(rowB.original.allocationValue);

      return (Number.isFinite(a) ? a : 0) - (Number.isFinite(b) ? b : 0);
    },
  },
  {
    id: "from",
    accessorFn: (row) => {
      const t = Date.parse(row.effectiveFrom);
      return Number.isFinite(t) ? t : -Infinity;
    },
    header: ({ column }) => <DataTableColumnHeader column={column} title="From" />,
    meta: { label: "From" },
    cell: ({ row }) => (
      <div className="flex min-h-[40px] flex-col justify-center px-4">
        <span className="font-medium">{formatDate(row.original.effectiveFrom)}</span>
      </div>
    ),
    sortingFn: (rowA, rowB) => {
      const a = Date.parse(rowA.original.effectiveFrom);
      const b = Date.parse(rowB.original.effectiveFrom);
      return (Number.isFinite(a) ? a : -Infinity) - (Number.isFinite(b) ? b : -Infinity);
    },
  },
  {
    id: "actions",
    enableHiding: false,
    header: () => null,
    cell: ({ row }) => {
      const a = row.original;
      return (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onEdit(a)} title="Edit">
            <Icons.Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(a)}
            title="Delete"
            className="text-destructive"
          >
            <Icons.Trash className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];
