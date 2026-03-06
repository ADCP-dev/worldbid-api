<script setup lang="ts">
import { z } from "zod";
import { toast } from "vue-sonner";
import { h, ref } from "vue";
import FormInput from "~/modules/ui-app/components/form/FormInput.vue";
import FormSelect from "~/modules/ui-app/components/form/FormSelect.vue";
import FormSwitch from "~/modules/ui-app/components/form/FormSwitch.vue";

// Define schema
const formSchema = z.object({
    username: z.string().min(2),
    email: z.string().email(),
    role: z.string().min(1),
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
    // Basic manual validation for the demo
    errors.value = {};
    const result = formSchema.safeParse(form.value);

    if (!result.success) {
        result.error.issues.forEach((issue) => {
            errors.value[issue.path[0] as string] = issue.message;
        });
        toast.error("Form validation failed");
        return;
    }

    toast.success("Form submitted!", {
        description: h('pre', { class: 'mt-2 w-full rounded-md bg-neutral p-4' },
            h('code', { class: 'text-neutral-content text-xs' }, JSON.stringify(form.value, null, 2))
        ),
    });
}
</script>

<template>
    <div class="container mx-auto py-10 px-4">
        <div class="flex flex-col gap-8 max-w-2xl mx-auto">
            <div>
                <h1 class="text-3xl font-bold tracking-tight mb-2">Form Components Demo</h1>
                <p class="text-base-content/60">
                    Ejemplo de uso de componentes de formulario modulares con validación Zod y daisyUI.
                </p>
            </div>

            <div class="card bg-base-100 shadow-xl border border-base-content/5">
                <div class="card-body p-8">
                    <h2 class="card-title text-xl mb-6">Profile Settings</h2>

                    <form @submit.prevent="onSubmit" class="space-y-6">
                        <FormInput
                            v-model="form.username"
                            label="Username"
                            placeholder="Introduce tu nombre de usuario"
                            :error="errors.username"
                            required
                            description="Este es tu nombre público visible para otros usuarios."
                        />

                        <FormInput
                            v-model="form.email"
                            label="Email"
                            type="email"
                            placeholder="ejemplo@correo.com"
                            :error="errors.email"
                            required
                        />

                        <FormSelect
                            v-model="form.role"
                            label="Role"
                            :options="roles"
                            placeholder="Selecciona un rol"
                            :error="errors.role"
                            required
                        />

                        <FormSwitch
                            v-model="form.notifications"
                            label="Enable notifications"
                            variant="primary"
                            description="Recibe alertas sobre actividad importante."
                        />

                        <div class="pt-4">
                            <button type="submit" class="btn btn-primary w-full sm:w-auto">
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="alert alert-info shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <div>
                <h3 class="font-bold">Nota sobre validación</h3>
                <div class="text-xs">Este formulario utiliza Zod para la validación de esquemas y muestra los errores directamente bajo cada campo.</div>
              </div>
            </div>
        </div>
    </div>
</template>
