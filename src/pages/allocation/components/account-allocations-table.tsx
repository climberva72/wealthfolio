import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AccountAllocation } from "@/lib/types";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash, ArrowUpDown } from "lucide-react";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

type AccountAllocationsTableProps = {
  rows: AccountAllocation[];
  sourceNameById: Map<string, string>;
  onEdit: (allocation: AccountAllocation) => void;
  onDelete: (allocation: AccountAllocation) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyText?: string;
};

export function AccountAllocationsTable({
  rows,
  sourceNameById,
  onEdit,
  onDelete,
  isLoading,
  isError,
  errorMessage,
  emptyText = "No allocations yet.",
}: AccountAllocationsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

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
        cell: (info) => formatDate(info.row.original.effectiveFrom),
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
                  <DropdownMenuItem onClick={() => onEdit(a)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete(a)}
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
    [sourceNameById, onEdit, onDelete],
  );

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

  if (isLoading) return <div>Loading...</div>;

  if (isError) {
    return (
      <div className="p-4 text-red-600">
        Failed to load allocations.
        {errorMessage ? (
          <pre className="mt-2 whitespace-pre-wrap text-xs text-red-700">
            {errorMessage}
          </pre>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <div className="w-full overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
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
                <td
                  className="p-4 text-muted-foreground"
                  colSpan={table.getAllLeafColumns().length}
                >
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
