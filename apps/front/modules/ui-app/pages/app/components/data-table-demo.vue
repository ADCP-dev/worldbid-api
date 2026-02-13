<script setup lang="ts">
import { h } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define the type locally as it's not exported from the module's types.ts in a way that's easily importable here without relative paths
interface FilterOption {
    value: string | number | boolean;
    label: string;
}

type MyColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
    options?: FilterOption[];
    headerName?: string;
    filterType?: 'number' | 'date' | 'string' | 'select' | 'boolean';
};

interface Payment {
    id: string;
    amount: number;
    status: "pending" | "processing" | "success" | "failed";
    email: string;
}

const data: Payment[] = [
    {
        id: "m5gr84i9",
        amount: 316,
        status: "success",
        email: "ken99@yahoo.com",
    },
    {
        id: "3u1reoj4",
        amount: 242,
        status: "success",
        email: "Abe45@gmail.com",
    },
    {
        id: "derv1ws0",
        amount: 837,
        status: "processing",
        email: "Monserrat44@gmail.com",
    },
    {
        id: "5kma53ae",
        amount: 874,
        status: "success",
        email: "Silas22@gmail.com",
    },
    {
        id: "bhqecj4p",
        amount: 721,
        status: "failed",
        email: "carmella@hotmail.com",
    },
    { id: "inv001", amount: 120, status: "pending", email: "user1@example.com" },
    { id: "inv002", amount: 200, status: "processing", email: "user2@example.com" },
    { id: "inv003", amount: 300, status: "success", email: "user3@example.com" },
    { id: "inv004", amount: 400, status: "failed", email: "user4@example.com" },
    { id: "inv005", amount: 500, status: "pending", email: "user5@example.com" },
];

const columns: MyColumnDef<Payment>[] = [
    {
        id: "select",
        header: ({ table }) =>
            h(Checkbox, {
                checked: table.getIsAllPageRowsSelected(),
                "onUpdate:checked": (value: boolean) =>
                    table.toggleAllPageRowsSelected(!!value),
                ariaLabel: "Select all",
            }),
        cell: ({ row }) =>
            h(Checkbox, {
                checked: row.getIsSelected(),
                "onUpdate:checked": (value: boolean) => row.toggleSelected(!!value),
                ariaLabel: "Select row",
            }),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: "status",
        headerName: "Estado",
        header: "Status",
        filterType: "select",
        options: [
            { label: "Pending", value: "pending" },
            { label: "Processing", value: "processing" },
            { label: "Success", value: "success" },
            { label: "Failed", value: "failed" },
        ],
        cell: ({ row }) => h("div", { class: "capitalize" }, row.getValue("status")),
    },
    {
        accessorKey: "email",
        headerName: "Email",
        header: ({ column }) => {
            return h(
                Button,
                {
                    variant: "ghost",
                    onClick: () => column.toggleSorting(column.getIsSorted() === "asc"),
                },
                () => ["Email", h(ArrowUpDown, { class: "ml-2 h-4 w-4" })]
            );
        },
        cell: ({ row }) => h("div", { class: "lowercase" }, row.getValue("email")),
    },
    {
        accessorKey: "amount",
        headerName: "Amount",
        header: () => h("div", { class: "text-right" }, "Amount"),
        cell: ({ row }) => {
            const amount = Number.parseFloat(row.getValue("amount"));
            const formatted = new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
            }).format(amount);
            return h("div", { class: "text-right font-medium" }, formatted);
        },
        filterType: "number",
    },
    {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
            const payment = row.original;
            return h(
                "div",
                { class: "relative" },
                h(DropdownMenu, {}, [
                    h(DropdownMenuTrigger, { asChild: true }, [
                        h(
                            Button,
                            { variant: "ghost", class: "h-8 w-8 p-0" },
                            [
                                h("span", { class: "sr-only" }, "Open menu"),
                                h(MoreHorizontal, { class: "h-4 w-4" }),
                            ]
                        ),
                    ]),
                    h(DropdownMenuContent, { align: "end" }, [
                        h(DropdownMenuLabel, "Actions"),
                        h(
                            DropdownMenuItem,
                            { onClick: () => navigator.clipboard.writeText(payment.id) },
                            "Copy payment ID"
                        ),
                        h(DropdownMenuSeparator),
                        h(DropdownMenuItem, "View customer"),
                        h(DropdownMenuItem, "View payment details"),
                    ]),
                ])
            );
        },
    },
];
</script>

<template>
    <div class="container mx-auto py-10">
        <div class="flex flex-col gap-4">
            <div>
                <h2 class="text-2xl font-bold tracking-tight">DataTable Demo</h2>
                <p class="text-muted-foreground">
                    Using the new modularized DataTable component.
                </p>
            </div>

            <Card class="w-full">
                <CardHeader>
                    <CardTitle>Payments</CardTitle>
                    <CardDescription>Manage your payments (Demo)</CardDescription>
                </CardHeader>
                <CardContent>
                    <DataTable :columns="columns" :data="data" tableName="payments-demo" />
                </CardContent>
            </Card>
        </div>
    </div>
</template>
