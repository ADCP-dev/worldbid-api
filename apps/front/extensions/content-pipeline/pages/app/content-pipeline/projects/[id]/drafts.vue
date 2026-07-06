<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { toast } from 'vue-sonner';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import ViewButton from '@base/ui-app/components/data-table/buttons/ViewButton.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const cp = useContentPipeline();

const projectId = computed(() => route.params.id as string);

const loading = ref(false);
const drafts = ref<any[]>([]);
const refreshKey = ref(0);

const statusOptions = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Published', value: 'published' },
];

const columns = computed(() => [
  {
    accessorKey: 'title',
    headerName: 'Title',
    header: 'Title',
    filterType: 'string' as const,
    cell: ({ row }: any) =>
      row.original.idea?.title || row.original.title || h('span', { class: 'text-base-content/40' }, 'Untitled'),
  },
  {
    accessorKey: 'status',
    headerName: 'Status',
    header: 'Status',
    filterType: 'select' as const,
    options: statusOptions,
    cell: ({ row }: any) => {
      const s = row.original.status;
      const badgeClass: Record<string, string> = {
        pending: 'badge-warning',
        approved: 'badge-success',
        rejected: 'badge-error',
        published: 'badge-primary',
      };
      return h(
        'span',
        { class: `badge badge-sm capitalize ${badgeClass[s] ?? 'badge-outline'}` },
        s || '—',
      );
    },
  },
  {
    accessorKey: 'createdAt',
    headerName: 'Created',
    header: 'Created',
    filterType: 'date' as const,
    cell: ({ row }: any) =>
      new Date(row.original.createdAt).toLocaleDateString('en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
  },
  {
    accessorKey: 'publishedAt',
    headerName: 'Published',
    header: 'Published',
    filterType: 'date' as const,
    cell: ({ row }: any) =>
      row.original.publishedAt
        ? new Date(row.original.publishedAt).toLocaleDateString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    id: 'actions',
    headerName: 'Actions',
    header: 'Actions',
    enableSorting: false,
    cell: ({ row }: any) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h(ViewButton, {
          ariaLabel: 'View draft',
          onClick: (e: Event) => {
            e.stopPropagation();
            navigateTo(`/app/content-pipeline/drafts/${row.original.id}`);
          },
        }),
        h(
          'button',
          {
            class: 'btn btn-success btn-xs',
            disabled: row.original.status !== 'pending',
            onClick: (e: Event) => {
              e.stopPropagation();
              handleApprove(row.original.id);
            },
          },
          'Approve',
        ),
        h(
          'button',
          {
            class: 'btn btn-error btn-outline btn-xs',
            disabled: row.original.status !== 'pending',
            onClick: (e: Event) => {
              e.stopPropagation();
              handleReject(row.original.id);
            },
          },
          'Reject',
        ),
        h(
          'button',
          {
            class: 'btn btn-primary btn-xs',
            disabled: row.original.status !== 'approved',
            onClick: (e: Event) => {
              e.stopPropagation();
              handlePublish(row.original.id);
            },
          },
          'Publish',
        ),
      ]),
  },
]);

async function loadDrafts() {
  loading.value = true;
  try {
    const res: any = await cp.getDrafts(projectId.value);
    drafts.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error loading drafts', { description: err.message });
  } finally {
    loading.value = false;
  }
}

onMounted(loadDrafts);

async function handleApprove(id: number | string) {
  try {
    await cp.approveDraft(id);
    toast.success('Draft approved');
    await loadDrafts();
  } catch (err: any) {
    toast.error('Error approving draft', { description: err.message });
  }
}

async function handleReject(id: number | string) {
  const reason = prompt('Rejection reason (optional):') || '';
  try {
    await cp.rejectDraft(id, { reason });
    toast.success('Draft rejected');
    await loadDrafts();
  } catch (err: any) {
    toast.error('Error rejecting draft', { description: err.message });
  }
}

async function handlePublish(id: number | string) {
  try {
    await cp.publishDraft(id);
    toast.success('Draft published');
    await loadDrafts();
  } catch (err: any) {
    toast.error('Error publishing draft', { description: err.message });
  }
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink :to="`/app/content-pipeline/projects/${projectId}`" class="btn btn-ghost btn-sm">
          ← Back
        </NuxtLink>
        <h1 class="text-2xl font-bold">Drafts</h1>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <DataTable
          :columns="columns"
          :data="drafts"
          :total="drafts.length"
          :table-name="`content-pipeline-drafts-${projectId}`"
          :refresh-key="refreshKey"
          @row-click="(row: any) => navigateTo(`/app/content-pipeline/drafts/${row.id}`)"
        />
      </div>
    </div>
  </div>
</template>