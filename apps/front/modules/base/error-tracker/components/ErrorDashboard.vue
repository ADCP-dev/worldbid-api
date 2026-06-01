<script setup lang="ts">
const {
  fetchErrors,
  clearErrors,
  deleteError,
  resolveError,
  clearResolvedErrors,
  reportError,
  testBackendError,
} = useErrors();

const {
  data: errors,
  refresh,
  pending,
} = await useAsyncData("errors", () => fetchErrors());

const selectedError = ref<any>(null);

const formatDate = (date: string) => {
  return new Date(date).toLocaleString();
};

const openModal = (error: any) => {
  selectedError.value = error;
  document.getElementById("error_modal")?.showModal();
};

const handleClear = async () => {
  await clearErrors();
  refresh();
};

const handleDelete = async (id: string) => {
  await deleteError(id);
  refresh();
};

const handleResolve = async (id: string) => {
  await resolveError(id);
  refresh();
};

const handleClearResolved = async () => {
  await clearResolvedErrors();
  refresh();
};

const triggerBackendError = async () => {
  try {
    await testBackendError();
  } catch (e) {
    console.log("Backend error test triggered");
  }
};

const testFrontendError = async () => {
  await reportError({
    message: "Test Frontend Error",
    source: "Frontend Test",
    stack: new Error("Test error stack trace").stack,
    metadata: {
      route: window.location.pathname,
      userAgent: navigator.userAgent,
    },
  });
  refresh();
};
</script>

<template>
  <div class="p-8 min-h-screen bg-base-200">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-4xl font-bold">Error Logs</h1>
      <div class="flex items-center gap-4">
        <div class="badge badge-error gap-2 p-4">
          Total: {{ errors?.length || 0 }}
        </div>
        <button
          class="btn btn-sm btn-warning btn-outline"
          @click="testFrontendError"
        >
          Test Frontend Error
        </button>
        <button
          class="btn btn-sm btn-error btn-outline"
          @click="triggerBackendError"
        >
          Test Backend Error
        </button>
        <button class="btn btn-sm btn-outline" @click="handleClearResolved">
          Clear Resolved
        </button>
        <button class="btn btn-sm btn-outline btn-error" @click="handleClear">
          Clear All
        </button>
      </div>
    </div>

    <div v-if="pending" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"/>
    </div>

    <div v-else-if="errors?.length === 0" class="alert alert-success">
      <span>No errors recorded. All good!</span>
    </div>

    <div v-else class="overflow-x-auto bg-base-100 rounded-box shadow">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th>Last Occurred</th>
            <th>Source</th>
            <th>Message</th>
            <th>Occurrences</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="err in errors" :key="err.id">
            <td class="whitespace-nowrap">
              {{ formatDate(err.lastOccurredAt) }}
            </td>
            <td>
              <span class="badge badge-ghost">{{ err.source }}</span>
            </td>
            <td class="font-mono text-sm max-w-md truncate">
              {{ err.message }}
            </td>
            <td>
              <div class="badge badge-neutral">{{ err.occurrences }}</div>
            </td>
            <td>
              <span v-if="err.resolved" class="badge badge-success"
                >Resolved</span
              >
              <span v-else class="badge badge-error">Active</span>
            </td>
            <td>
              <div class="flex gap-1">
                <button class="btn btn-sm btn-primary" @click="openModal(err)">
                  View
                </button>
                <button
                  v-if="!err.resolved"
                  class="btn btn-sm btn-success"
                  @click="handleResolve(err.id)"
                >
                  Resolve
                </button>
                <button
                  class="btn btn-sm btn-error btn-outline"
                  @click="handleDelete(err.id)"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <dialog id="error_modal" class="modal">
      <div class="modal-box w-11/12 max-w-5xl">
        <h3 class="font-bold text-2xl text-error mb-2">
          {{ selectedError?.message }}
        </h3>
        <div class="flex gap-2 mb-4">
          <span class="badge badge-outline">
            Occurrences: {{ selectedError?.occurrences }}
          </span>
          <span class="badge badge-outline">
            First: {{ formatDate(selectedError?.firstOccurredAt) }}
          </span>
        </div>

        <div class="divider">Stack Trace</div>

        <div
          class="mockup-code bg-neutral text-neutral-content max-h-96 overflow-y-auto"
        >
          <pre
            data-prefix=">"
          ><code>{{ selectedError?.stack || 'No stack trace available' }}</code></pre>
        </div>

        <div v-if="selectedError?.metadata" class="divider">Metadata</div>
        <div
          v-if="selectedError?.metadata"
          class="bg-base-300 p-4 rounded-xl overflow-x-auto font-mono text-sm"
        >
          <pre>{{ JSON.stringify(selectedError.metadata, null, 2) }}</pre>
        </div>

        <div class="modal-action">
          <form method="dialog">
            <button class="btn">Close</button>
          </form>
        </div>
      </div>
    </dialog>
  </div>
</template>
