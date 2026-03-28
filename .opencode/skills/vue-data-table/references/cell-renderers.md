# Cell Renderer Patterns

Examples of custom cell renderers using Vue's `h()` function.

## Basic Cell Renderers

### Plain Text

```typescript
cell: ({ getValue }: any) => {
  return h("span", {}, getValue());
};
```

### Bold Text

```typescript
cell: ({ getValue }: any) => {
  return h("span", { class: "font-bold" }, getValue());
};
```

### Colored Text

```typescript
cell: ({ row }: any) => {
  const value = row.original.status;
  const colorClass =
    value === "active"
      ? "text-success"
      : value === "pending"
        ? "text-warning"
        : "text-error";
  return h("span", { class: colorClass }, value);
};
```

## Badge Cells

### Status Badge

```typescript
cell: ({ row }: any) => {
  const statusName = row.original.status?.name || "Unknown";
  const badgeClass =
    statusName === "Active"
      ? "badge-success text-white"
      : statusName === "Inactive"
        ? "badge-neutral"
        : "badge-warning";
  return h("div", { class: ["badge", badgeClass] }, statusName);
};
```

### Role Badge

```typescript
cell: ({ row }: any) => {
  const roleName = row.original.role?.name || "User";
  const badgeClass =
    roleName === "Admin"
      ? "badge-error text-white"
      : roleName === "Manager"
        ? "badge-warning"
        : "badge-ghost";
  return h("div", { class: ["badge", badgeClass] }, roleName);
};
```

### Boolean Badge

```typescript
cell: ({ row }: any) => {
  const isActive = row.original.isActive;
  return h(
    "div",
    { class: ["badge", isActive ? "badge-success" : "badge-error"] },
    isActive ? "Yes" : "No",
  );
};
```

## Icon + Text Cells

### User with Avatar

```typescript
cell: ({ row }: any) => {
  const user = row.original;
  return h("div", { class: "flex items-center gap-3" }, [
    h("div", { class: "avatar" }, [
      h("div", { class: "w-8 h-8 rounded-full" }, [
        h("img", {
          src: user.avatar || "/default-avatar.png",
          class: "object-cover",
        }),
      ]),
    ]),
    h("span", {}, user.name),
  ]);
};
```

### Icon Button

```typescript
import { ExternalLinkIcon } from "lucide-vue-next";

cell: ({ row }: any) => {
  const url = row.original.url;
  return h(
    "a",
    {
      href: url,
      target: "_blank",
      class: "btn btn-ghost btn-xs",
    },
    [h(ExternalLinkIcon, { class: "w-4 h-4" })],
  );
};
```

## Action Menu Cell

### Standard Action Menu

```typescript
import { EditIcon, Trash2Icon, EllipsisVerticalIcon } from "lucide-vue-next";
import TableActionMenu from "@/components/ui/TableActionMenu.vue";

cell: ({ row }: any) => {
  const item = row.original;
  return h(
    TableActionMenu,
    {},
    {
      trigger: () =>
        h("button", { class: "btn btn-ghost btn-xs btn-square" }, [
          h(EllipsisVerticalIcon, { class: "w-4 h-4" }),
        ]),
      default: ({ close }: { close: () => void }) => [
        h("li", {}, [
          h(
            "button",
            {
              onClick: () => {
                close();
                handleEdit(item);
              },
            },
            [h(EditIcon, { class: "w-4 h-4" }), "Edit"],
          ),
        ]),
        h("li", { class: "text-error" }, [
          h(
            "button",
            {
              onClick: () => {
                close();
                handleDelete(item);
              },
            },
            [h(Trash2Icon, { class: "w-4 h-4" }), "Delete"],
          ),
        ]),
      ],
    },
  );
};
```

### Action Menu with Multiple Actions

```typescript
cell: ({ row }: any) => {
  const user = row.original;
  return h(
    TableActionMenu,
    {},
    {
      trigger: () =>
        h("button", { class: "btn btn-ghost btn-xs btn-square" }, [
          h(EllipsisVerticalIcon, { class: "w-4 h-4" }),
        ]),
      default: ({ close }: { close: () => void }) => [
        h("li", {}, [
          h(
            "button",
            {
              onClick: () => {
                close();
                handleView(user);
              },
            },
            [h(EyeIcon, { class: "w-4 h-4" }), "View"],
          ),
        ]),
        h("li", {}, [
          h(
            "button",
            {
              onClick: () => {
                close();
                handleEdit(user);
              },
            },
            [h(EditIcon, { class: "w-4 h-4" }), "Edit"],
          ),
        ]),
        h("li", {}, [
          h(
            "button",
            {
              onClick: () => {
                close();
                handleClone(user);
              },
            },
            [h(CopyIcon, { class: "w-4 h-4" }), "Clone"],
          ),
        ]),
        h("li", { class: "border-t border-base-200 mt-1 pt-1" }, [
          h(
            "button",
            {
              class: "text-error",
              onClick: () => {
                close();
                handleDelete(user);
              },
            },
            [h(Trash2Icon, { class: "w-4 h-4" }), "Delete"],
          ),
        ]),
      ],
    },
  );
};
```

## Formatted Values

### Currency

```typescript
cell: ({ row }: any) => {
  const amount = row.original.amount;
  return h(
    "span",
    { class: "font-mono" },
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount),
  );
};
```

### Percentage

```typescript
cell: ({ row }: any) => {
  const percent = row.original.percent;
  return h("div", { class: "flex items-center gap-2" }, [
    h("progress", {
      class: "progress w-20",
      value: percent,
      max: "100",
    }),
    h("span", { class: "text-sm" }, `${percent}%`),
  ]);
};
```

### Date

```typescript
cell: ({ row }: any) => {
  const date = new Date(row.original.createdAt);
  return h(
    "span",
    {},
    date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  );
};
```

### DateTime

```typescript
cell: ({ row }: any) => {
  const date = new Date(row.original.updatedAt);
  return h(
    "span",
    { class: "text-sm text-base-content/70" },
    date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
};
```

### Relative Time

```typescript
cell: ({ row }: any) => {
  const date = new Date(row.original.createdAt);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  let text;
  if (days === 0) text = "Today";
  else if (days === 1) text = "Yesterday";
  else if (days < 7) text = `${days} days ago`;
  else if (days < 30) text = `${Math.floor(days / 7)} weeks ago`;
  else text = `${Math.floor(days / 30)} months ago`;

  return h("span", { class: "text-base-content/70" }, text);
};
```

## Conditional Styling

### Row Background by Status

```typescript
cell: ({ row }: any) => {
  const status = row.original.status;
  let bgClass = "";
  if (status === "urgent") bgClass = "bg-error/10";
  else if (status === "pending") bgClass = "bg-warning/10";

  return h("div", { class: ["px-2 py-1 rounded", bgClass] }, status);
};
```

### Priority Indicator

```typescript
cell: ({ row }: any) => {
  const priority = row.original.priority; // 1, 2, 3
  const colors = ["text-error", "text-warning", "text-success"];
  const labels = ["High", "Medium", "Low"];

  return h("div", { class: "flex items-center gap-2" }, [
    h("div", { class: ["w-2 h-2 rounded-full", colors[priority - 1]] }),
    h("span", {}, labels[priority - 1]),
  ]);
};
```

## Interactive Cells

### Clickable Link

```typescript
cell: ({ row }: any) => {
  const item = row.original;
  return h(
    "a",
    {
      href: `/items/${item.id}`,
      class: "link link-primary",
      onClick: (e) => {
        e.stopPropagation();
        // Handle click without triggering row-click
      },
    },
    item.name,
  );
};
```

### Toggle Switch

```typescript
cell: ({ row }: any) => {
  const item = row.original;
  return h("input", {
    type: "checkbox",
    class: "toggle toggle-primary",
    checked: item.isActive,
    onChange: (e) => {
      handleToggle(item.id, e.target.checked);
    },
  });
};
```

### Progress Bar

```typescript
cell: ({ row }: any) => {
  const progress = row.original.progress; // 0-100
  return h("div", { class: "w-full" }, [
    h("div", { class: "w-full bg-base-300 rounded-full h-2" }, [
      h("div", {
        class: "bg-primary h-2 rounded-full",
        style: { width: `${progress}%` },
      }),
    ]),
  ]);
};
```

## Composition Patterns

### Multiple Elements

```typescript
cell: ({ row }: any) => {
  const item = row.original;
  return h("div", { class: "flex flex-col" }, [
    h("span", { class: "font-medium" }, item.name),
    h("span", { class: "text-sm text-base-content/60" }, item.email),
  ]);
};
```

### With Icon and Text

```typescript
cell: ({ row }: any) => {
  const count = row.original.itemCount;
  return h("div", { class: "flex items-center gap-2" }, [
    h(PackageIcon, { class: "w-4 h-4 text-base-content/50" }),
    h("span", {}, `${count} items`),
  ]);
};
```

### Conditional Content

```typescript
cell: ({ row }: any) => {
  const item = row.original;
  if (item.deletedAt) {
    return h("span", { class: "line-through text-base-content/50" }, item.name);
  }
  return h("span", {}, item.name);
};
```
