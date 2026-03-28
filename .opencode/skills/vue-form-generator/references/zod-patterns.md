# Zod Validation Patterns

Common Zod schema patterns for form validation.

## Basic Types

### Required String

```typescript
z.string().min(1, "Field is required");
```

### Optional String

```typescript
z.string().optional();
```

### String with Min/Max Length

```typescript
z.string().min(2, "Too short").max(100, "Too long");
```

### Email

```typescript
z.string().email("Invalid email address");
```

### URL

```typescript
z.string().url("Invalid URL");
```

### UUID

```typescript
z.string().uuid("Invalid UUID");
```

## Numbers

### Required Number

```typescript
z.number({ required_error: "Number is required" });
```

### Number with Min/Max

```typescript
z.number().min(0, "Must be positive").max(100, "Max value is 100");
```

### Integer

```typescript
z.number().int("Must be an integer");
```

## Booleans

### Boolean with Default

```typescript
z.boolean().default(false).optional();
```

### Required Boolean

```typescript
z.boolean();
```

## Dates

### Required Date (ISO string)

```typescript
z.string().min(1, "Date is required");
```

### Date Object

```typescript
z.date({ required_error: "Date is required" });
```

## Enums

### String Enum

```typescript
z.enum(["admin", "user", "manager"], {
  error: "Please select a valid role",
});
```

### Native Enum

```typescript
enum Role {
  Admin = "admin",
  User = "user",
}
z.nativeEnum(Role);
```

## Objects

### Basic Object

```typescript
z.object({
  name: z.string().min(1),
  email: z.string().email(),
});
```

### With Optional Fields

```typescript
z.object({
  name: z.string().min(1),
  bio: z.string().optional(),
  age: z.number().optional(),
});
```

### With Defaults

```typescript
z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
  notifications: z.boolean().default(false),
});
```

## Arrays

### String Array

```typescript
z.array(z.string()).min(1, "Select at least one");
```

### Number Array

```typescript
z.array(z.number());
```

## Advanced Patterns

### Dependent Fields

```typescript
z.object({
  type: z.enum(["personal", "company"]),
  companyName: z.string().optional(),
  companyTaxId: z.string().optional(),
}).refine(
  (data) => {
    if (data.type === "company") {
      return data.companyName && data.companyTaxId;
    }
    return true;
  },
  {
    message: "Company name and Tax ID are required for company type",
    path: ["companyName"],
  },
);
```

### Custom Validation

```typescript
z.string().refine(
  (val) => {
    return val.includes("@");
  },
  {
    message: "Must contain @",
  },
);
```

### Regex Validation

```typescript
z.string().regex(/^[A-Z]{2}\d{4}$/, "Must match pattern AB1234");
```

### Coercion

```typescript
z.coerce.number(); // "42" → 42
z.coerce.boolean(); // "false" → false
```

## Common Schema Examples

### User Form

```typescript
const userSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters"),
  email: z.string().email("Invalid email"),
  role: z.enum(["admin", "user", "manager"], {
    error: "Please select a role",
  }),
  active: z.boolean().default(true),
  bio: z.string().max(500).optional(),
});
```

### Login Form

```typescript
const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().default(false),
});
```

### Product Form

```typescript
const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  price: z.number().min(0.01, "Price must be greater than 0"),
  category: z.string().min(1, "Select a category"),
  description: z.string().max(1000).optional(),
  inStock: z.boolean().default(true),
});
```

### Date Range

```typescript
const dateRangeSchema = z
  .object({
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
  })
  .refine(
    (data) => {
      return new Date(data.endDate) > new Date(data.startDate);
    },
    {
      message: "End date must be after start date",
      path: ["endDate"],
    },
  );
```

## Error Handling

### Safe Parse

```typescript
const result = schema.safeParse(data);

if (!result.success) {
  const errors = {};
  result.error.issues.forEach((issue) => {
    errors[issue.path[0]] = issue.message;
  });
}
```

### Parse (throws)

```typescript
try {
  const validData = schema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    error.issues.forEach((issue) => {
      console.log(issue.path, issue.message);
    });
  }
}
```

### Error Map

```typescript
const customErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.too_small) {
    return { message: `Too short! Minimum ${issue.minimum} characters` };
  }
  return { message: ctx.defaultError };
};

const schema = z.string().min(5).errorMap(customErrorMap);
```
