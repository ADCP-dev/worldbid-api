<script setup lang="ts">
import { z } from "zod";
import { toast } from "vue-sonner";

// Define schema
const formSchema = z.object({
    username: z.string().min(2, {
        message: "Username must be at least 2 characters.",
    }),
    email: z.string().email({
        message: "Invalid email address.",
    }),
    role: z.string().min(1, {
        message: "Please select a role.",
    }),
    notifications: z.boolean().default(false).optional(),
    bio: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const form = ref<FormValues>({
    username: "",
    email: "",
    role: "",
    notifications: false,
    bio: "",
});

const errors = ref<Record<string, string>>({});

const roles = [
    { value: "admin", label: "Admin" },
    { value: "user", label: "User" },
    { value: "manager", label: "Manager" },
];

function onSubmit() {
    if (!validateForm(formSchema, form.value, errors)) {
        toast.error("Form validation failed");
        return;
    }

    toast.success("Form submitted!", {
        description: h('pre', { class: 'mt-2 w-[340px] rounded-md bg-slate-950 p-4' },
            h('code', { class: 'text-white' }, JSON.stringify(form.value, null, 2))
        ),
    });
}
</script>

<template>
    <div class="container mx-auto py-10">
        <div class="flex flex-col gap-4 max-w-2xl">
            <div>
                <h2 class="text-2xl font-bold tracking-tight">Form Components Demo</h2>
                <p class="text-muted-foreground">
                    Using modularized form components and validateForm utility.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Profile Settings</CardTitle>
                    <CardDescription>Update your profile information.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form @submit.prevent="onSubmit" class="space-y-6">
                        <FormInput v-model="form.username" label="Username" placeholder="shadcn"
                            :error="errors.username" required description="This is your public display name." />

                        <FormInput v-model="form.email" label="Email" type="email" placeholder="m@example.com"
                            :error="errors.email" required />

                        <FormSelect v-model="form.role" label="Role" :options="roles" placeholder="Select a role"
                            :error="errors.role" required />

                        <div class="flex items-center space-x-2">
                            <!-- Checkbox isn't in our ui-admin module yet, utilizing shadcn primitive directly or if we moved it. 
                    Checking our move list... Checkbox wasn't moved. So we use it from components/ui/checkbox? 
                    Wait, let's stick to what we have in ui-admin or fallback to standard inputs if needed.
                    Actually FormSelect, FormInput are there. Let's use a standard checkbox or if we need one.
               -->
                            <input type="checkbox" v-model="form.notifications" id="notifications"
                                class="rounded border-gray-300" />
                            <Label htmlFor="notifications">Enable notifications</Label>
                        </div>

                        <Button type="submit">Submit</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    </div>
</template>
