import { useMemo, useState } from "react";

import { getAccounts } from "@/commands/account";
import { Button } from "@/components/ui/button";
import { useAccountAllocations } from "@/hooks/use-account-allocations";
import { QueryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";

import type { AccountAllocation } from "@/lib/types";
import { AddAllocationDialog } from "./components/add-allocation-dialog";
import { EditAllocationDialog } from "./components/edit-allocation-dialog";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { MoreHorizontal, Pencil, Trash, ArrowUpDown } from "lucide-react";

// ✅ react-table
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

export default function AccountAllocationsPage() {
  // const { accountId } = useParams() as { accountId: string };
  const accountId = "7808db71-e296-4a5c-b06e-f0d04fe2cba6";

  const accountsQuery = useQuery({
    queryKey: [QueryKeys.ACCOUNTS],
    queryFn: getAccounts,
  });

  const account = accountsQuery.data?.find((a) => a.id === accountId);

  const { allocationsQuery, createMutation, updateMutation, deleteMutation } =
    useAccountAllocations(accountId);

  const sourceAccounts = useMemo(
    () => (accountsQuery.data ?? []).filter((a) => !a.isVirtual),
    [accountsQuery.data],
  );

  // Map for fast lookup (used in table + sorting)
  const sourceNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of sourceAccounts) m.set(a.id, a.name);
    return m;
  }, [sourceAccounts]);

  // --- UI state for edit/delete ---
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AccountAllocation | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState<AccountAllocation | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);

  // Always define rows (even if loading)
  const rows = allocationsQuery.data ?? [];

  // Helpers (safe even when rows empty)
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString();
  };

  const columns = useMemo<ColumnDef<AccountAllocation>[]>(
    () => [
      {
        id: "source",
        header: "Source",
        accessorFn: (row) =>
          sourceNameById.get(row.sourceAccountId) ?? row.sourceAccountId,
        cell: (info) => (
          <span className="truncate">{info.getValue<string>()}</span>
        ),
        sortingFn: "alphanumeric",
        size: 260,
        minSize: 140,
      },
      {
        id: "asset",
        header: "Asset",
        accessorKey: "assetId",
        cell: (info) => <span className="truncate">{info.getValue<string>()}</span>,
        sortingFn: "alphanumeric",
        size: 220,
        minSize: 120,
      },
      {
        id: "value",
        header: "Value",
        accessorFn: (row) => {
          const n =
            typeof row.allocationValue === "number"
              ? row.allocationValue
              : Number(row.allocationValue);
          return Number.isFinite(n) ? n : 0;
        },
        cell: (info) => (
          <span className="font-medium tabular-nums">{info.getValue<number>()}%</span>
        ),
        sortingFn: "basic",
        size: 120,
        minSize: 90,
        meta: { align: "right" as const },
      },
      {
        id: "from",
        header: "From",
        accessorFn: (row) => {
          const t = Date.parse(row.effectiveFrom);
          return Number.isFinite(t) ? t : -Infinity;
        },
        cell: (info) => {
          const a = info.row.original;
          const original = a.effectiveFrom;
          return formatDate(original)
        },
        sortingFn: "basic",
        size: 140,
        minSize: 110,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableResizing: false,
        size: 90,
        cell: ({ row }) => {
          const a = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Row actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(a);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => {
                      setDeleting(a);
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [sourceNameById],
  );

  // ✅ MUST be called every render (no early returns above)
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });

  // ✅ Guard returns AFTER hooks
  if (!account) return null;

  if (!account.isVirtual) {
    return (
      <div className="p-4">
        Allocations are only available for virtual accounts.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Allocations</h2>

        <AddAllocationDialog
          virtualAccountId={accountId}
          sourceAccounts={sourceAccounts}
          onCreate={(payload) => createMutation.mutate(payload)}
          isSubmitting={createMutation.isPending}
        />
      </div>

      {/* Content */}
      {allocationsQuery.isLoading ? (
        <div>Loading...</div>
      ) : allocationsQuery.isError ? (
        <div className="p-4 text-red-600">
          Failed to load allocations.
          <pre className="mt-2 whitespace-pre-wrap text-xs text-red-700">
            {(() => {
              const e = allocationsQuery.error as any;
              return e?.message ?? JSON.stringify(e, null, 2);
            })()}
          </pre>
        </div>
      ) : (
        <div className="rounded-md border">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id} className="border-b">
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted(); // false | 'asc' | 'desc'
                      const align =
                        (header.column.columnDef.meta as any)?.align ?? "left";

                      return (
                        <th
                          key={header.id}
                          className={[
                            "relative select-none p-2",
                            align === "right" ? "text-right" : "text-left",
                          ].join(" ")}
                          style={{ width: header.getSize() }}
                        >
                          <div
                            className={[
                              "inline-flex items-center gap-1",
                              canSort ? "cursor-pointer" : "",
                              align === "right" ? "justify-end w-full" : "",
                            ].join(" ")}
                            onClick={
                              canSort
                                ? header.column.getToggleSortingHandler()
                                : undefined
                            }
                            title={
                              canSort
                                ? sorted === "asc"
                                  ? "Sorted ascending"
                                  : sorted === "desc"
                                    ? "Sorted descending"
                                    : "Sort"
                                : undefined
                            }
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {canSort ? (
                              <span className="text-muted-foreground">
                                {sorted === "asc" ? (
                                  "▲"
                                ) : sorted === "desc" ? (
                                  "▼"
                                ) : (
                                  <ArrowUpDown className="h-3.5 w-3.5" />
                                )}
                              </span>
                            ) : null}
                          </div>

                          {/* Resizer handle */}
                          {header.column.getCanResize() ? (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={[
                                "absolute right-0 top-0 h-full w-1.5 cursor-col-resize",
                                "hover:bg-muted/60",
                                header.column.getIsResizing() ? "bg-muted/80" : "",
                              ].join(" ")}
                            />
                          ) : null}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>

              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    {row.getVisibleCells().map((cell) => {
                      const align =
                        (cell.column.columnDef.meta as any)?.align ?? "left";
                      return (
                        <td
                          key={cell.id}
                          className={[
                            "p-2 align-middle",
                            align === "right" ? "text-right" : "text-left",
                          ].join(" ")}
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {rows.length === 0 ? (
                  <tr>
                    <td className="p-4 text-muted-foreground" colSpan={5}>
                      No allocations yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- Edit Dialog ---------------- */}
      <EditAllocationDialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditing(null);
        }}
        allocation={editing}
        virtualAccountId={accountId}
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
    </div>
  );
}
