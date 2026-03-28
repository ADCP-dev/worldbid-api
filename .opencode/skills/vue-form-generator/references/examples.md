# Form Examples

Complete form examples ready to use.

## Simple Login Form

```vue
<script setup lang="ts">
import { z } from "zod";
import { toast } from "vue-sonner";
import { ref } from "vue";
import FormInput from "@/modules/base/ui-app/components/form/FormInput.vue";
import FormSwitch from "@/modules/base/ui-app/components/form/FormSwitch.vue";

const formSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  remember: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

const form = ref<FormValues>({
  email: "",
  password: "",
  remember: false,
});

const errors = ref<Record<string, string>>({});

async function onSubmit() {
  errors.value = {};
  const result = formSchema.safeParse(form.value);

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      errors.value[issue.path[0] as string] = issue.message;
    });
    toast.error("Login failed");
    return;
  }

  // Login logic
  toast.success("Logged in!");
}
</script>

<template>
  <div class="max-w-md mx-auto p-6">
    <form @submit.prevent="onSubmit" class="space-y-6">
      <FormInput
        v-model="form.email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        :error="errors.email"
        required
      />

      <FormInput
        v-model="form.password"
        label="Password"
        type="password"
        placeholder="••••••••"
        :error="errors.password"
        required
      />

      <FormSwitch v-model="form.remember" label="Remember me" />

      <button type="submit" class="btn btn-primary w-full">Login</button>
    </form>
  </div>
</template>
```

## User Profile Form

```vue
<script setup lang="ts">
import { z } from "zod";
import { toast } from "vue-sonner";
import { h, ref } from "vue";
import FormInput from "@/modules/base/ui-app/components/form/FormInput.vue";
import FormSelect from "@/modules/base/ui-app/components/form/FormSelect.vue";
import FormSwitch from "@/modules/base/ui-app/components/form/FormSwitch.vue";
import FormDate from "@/modules/base/ui-app/components/form/FormDate.vue";
import { CalendarDate } from "@internationalized/date";

const formSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid email"),
  role: z.string().min(1, "Select a role"),
  birthDate: z.any().optional(),
  bio: z.string().max(500).optional(),
  notifications: z.boolean().default(false),
  marketing: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

const roles = [
  { value: "admin", label: "Administrator" },
  { value: "user", label: "Standard User" },
  { value: "manager", label: "Manager" },
];

const form = ref<FormValues>({
  firstName: "",
  lastName: "",
  email: "",
  role: "",
  birthDate: null,
  bio: "",
  notifications: false,
  marketing: false,
});

const errors = ref<Record<string, string>>({});

function onSubmit() {
  errors.value = {};
  const result = formSchema.safeParse(form.value);

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      errors.value[issue.path[0] as string] = issue.message;
    });
    toast.error("Please fix the errors");
    return;
  }

  toast.success("Profile updated!", {
    description: h(
      "pre",
      { class: "mt-2 p-2 bg-base-200 rounded" },
      JSON.stringify(form.value, null, 2),
    ),
  });
}
</script>

<template>
  <div class="container mx-auto py-10 px-4">
    <div class="max-w-2xl mx-auto">
      <h1 class="text-2xl font-bold mb-6">Edit Profile</h1>

      <form @submit.prevent="onSubmit" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            v-model="form.firstName"
            label="First Name"
            placeholder="John"
            :error="errors.firstName"
            required
          />

          <FormInput
            v-model="form.lastName"
            label="Last Name"
            placeholder="Doe"
            :error="errors.lastName"
            required
          />
        </div>

        <FormInput
          v-model="form.email"
          label="Email"
          type="email"
          placeholder="john.doe@example.com"
          :error="errors.email"
          required
        />

        <FormSelect
          v-model="form.role"
          label="Role"
          :options="roles"
          placeholder="Select a role"
          :error="errors.role"
          required
        />

        <FormInput
          v-model="form.bio"
          label="Bio"
          placeholder="Tell us about yourself..."
          :error="errors.bio"
          description="Max 500 characters"
        />

        <div class="divider">Preferences</div>

        <FormSwitch
          v-model="form.notifications"
          label="Enable notifications"
          description="Receive alerts about your account activity."
        />

        <FormSwitch
          v-model="form.marketing"
          label="Marketing emails"
          description="Receive updates about new features and promotions."
        />

        <div class="flex gap-4">
          <button type="submit" class="btn btn-primary">Save Changes</button>
          <button type="button" class="btn btn-outline">Cancel</button>
        </div>
      </form>
    </div>
  </div>
</template>
```

## Settings Form

```vue
<script setup lang="ts">
import { z } from "zod";
import { toast } from "vue-sonner";
import { ref } from "vue";
import FormInput from "@/modules/base/ui-app/components/form/FormInput.vue";
import FormSelect from "@/modules/base/ui-app/components/form/FormSelect.vue";
import FormSwitch from "@/modules/base/ui-app/components/form/FormSwitch.vue";

const formSchema = z.object({
  siteName: z.string().min(1, "Site name is required"),
  siteUrl: z.string().url("Invalid URL"),
  timezone: z.string().min(1, "Select timezone"),
  language: z.string().min(1, "Select language"),
  maintenance: z.boolean().default(false),
  registration: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

const timezones = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time" },
  { value: "Europe/Madrid", label: "Madrid" },
];

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
];

const form = ref<FormValues>({
  siteName: "",
  siteUrl: "",
  timezone: "",
  language: "",
  maintenance: false,
  registration: true,
});

const errors = ref<Record<string, string>>({});

function onSubmit() {
  errors.value = {};
  const result = formSchema.safeParse(form.value);

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      errors.value[issue.path[0] as string] = issue.message;
    });
    toast.error("Validation failed");
    return;
  }

  toast.success("Settings saved!");
}
</script>

<template>
  <div class="max-w-xl">
    <h1 class="text-xl font-bold mb-6">Site Settings</h1>

    <form @submit.prevent="onSubmit" class="space-y-6">
      <FormInput
        v-model="form.siteName"
        label="Site Name"
        placeholder="My Awesome Site"
        :error="errors.siteName"
        required
      />

      <FormInput
        v-model="form.siteUrl"
        label="Site URL"
        placeholder="https://example.com"
        :error="errors.siteUrl"
        required
      />

      <div class="grid grid-cols-2 gap-4">
        <FormSelect
          v-model="form.timezone"
          label="Timezone"
          :options="timezones"
          placeholder="Select timezone"
          :error="errors.timezone"
          required
        />

        <FormSelect
          v-model="form.language"
          label="Language"
          :options="languages"
          placeholder="Select language"
          :error="errors.language"
          required
        />
      </div>

      <div class="divider">Features</div>

      <FormSwitch
        v-model="form.maintenance"
        label="Maintenance mode"
        description="Site will show maintenance page to visitors."
      />

      <FormSwitch
        v-model="form.registration"
        label="Allow new registrations"
        description="Users can register new accounts."
      />

      <button type="submit" class="btn btn-primary">Save Settings</button>
    </form>
  </div>
</template>
```
