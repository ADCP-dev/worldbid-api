<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { ref, watch, computed } from 'vue';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Save,
  Clock3,
  Type as TypeIcon,
} from 'lucide-vue-next';
import TagsChipsInput from './TagsChipsInput.vue';

const props = defineProps<{
  modelValue: string;
  title: string;
  categoryPath?: string | null;
  tags?: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:title': [value: string];
  'update:categoryPath': [value: string];
  'update:tags': [value: string[]];
  save: [];
}>();

const { t } = useI18n();

const editor = useEditor({
  content: props.modelValue || '<p></p>',
  extensions: [StarterKit],
  injectCSS: false,
  editorProps: {
    attributes: {
      class:
        'prose prose-sm sm:prose-base lg:prose-lg m-4 focus:outline-none dark:prose-invert max-w-none min-h-[300px]',
    },
  },
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML());
  },
});

const localTitle = ref(props.title);
const localCategoryPath = ref(props.categoryPath ?? '');
const localTags = ref<string[]>(props.tags ?? []);

watch(() => props.title, (v) => { localTitle.value = v; });
watch(() => props.categoryPath, (v) => { localCategoryPath.value = v ?? ''; });
watch(() => props.tags, (v) => { localTags.value = v ?? []; });

watch(localTitle, (v) => emit('update:title', v));
watch(localCategoryPath, (v) => emit('update:categoryPath', v));
watch(localTags, (v) => emit('update:tags', v), { deep: true });

watch(() => props.modelValue, (v) => {
  if (editor.value && editor.value.getHTML() !== v) {
    editor.value.commands.setContent(v, false);
  }
});

/* ── Breadcrumbs from dotted categoryPath ("tech.notes.async" → pills) ── */
const breadcrumbs = computed<string[]>(() => {
  const cp = (props.categoryPath ?? '').split('.').map((s) => s.trim()).filter(Boolean);
  return cp.length > 0 ? cp : [t('ext.ka.notes.uncategorized', 'uncategorized')];
});

/* ── Word count + reading time from editor text ────────────────────── */
const wordCount = computed(() => {
  const text = editor.value?.getText() ?? '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
});
const readingMinutes = computed(() => Math.max(1, Math.ceil(wordCount.value / 200)));

const canUndo = computed(() => editor.value?.can().chain().focus().undo().run() ?? false);
const canRedo = computed(() => editor.value?.can().chain().focus().redo().run() ?? false);

function setHeading(level: 1 | 2) {
  editor.value?.chain().focus().toggleHeading({ level }).run();
}
function toggleBold() { editor.value?.chain().focus().toggleBold().run(); }
function toggleItalic() { editor.value?.chain().focus().toggleItalic().run(); }
function toggleBulletList() { editor.value?.chain().focus().toggleBulletList().run(); }
function toggleOrderedList() { editor.value?.chain().focus().toggleOrderedList().run(); }
function toggleBlockquote() { editor.value?.chain().focus().toggleBlockquote().run(); }
function toggleCode() { editor.value?.chain().focus().toggleCodeBlock().run(); }
function undo() { editor.value?.chain().focus().undo().run(); }
function redo() { editor.value?.chain().focus().redo().run(); }
function save() { emit('save'); }
</script>

<template>
  <div class="flex flex-col h-full border rounded-lg bg-base-100">
    <div class="border-b border-base-300 p-3 space-y-2.5">
      <!-- Title -->
      <input
        v-model="localTitle"
        type="text"
        :placeholder="t('ext.ka.notes.titlePlaceholder', 'Note title')"
        class="input input-ghost w-full text-xl font-bold px-0 focus:outline-none focus:bg-transparent placeholder:text-base-content/30"
      >

      <!-- Category breadcrumbs -->
      <div class="flex items-center gap-1 text-xs text-base-content/60">
        <span
          v-for="(crumb, i) in breadcrumbs"
          :key="`${crumb}-${i}`"
          class="inline-flex items-center"
        >
          <span class="px-1.5 py-0.5 rounded-md bg-base-200 font-medium">{{ crumb }}</span>
          <span v-if="i < breadcrumbs.length - 1" class="mx-1 text-base-content/30">/</span>
        </span>
      </div>

      <!-- Category input (raw dotted path — feeds breadcrumbs) -->
      <input
        v-model="localCategoryPath"
        type="text"
        :placeholder="t('ext.ka.notes.categoryPlaceholder', 'Category path, e.g. tech.notes.async')"
        class="input input-bordered input-sm w-full font-mono"
      >

      <!-- Tags chips -->
      <TagsChipsInput v-model="localTags" />

      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-1 pt-1">
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('bold') }" title="Bold" @click="toggleBold">
          <Bold class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('italic') }" title="Italic" @click="toggleItalic">
          <Italic class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('heading', { level: 1 }) }" title="Heading 1" @click="setHeading(1)">
          <Heading1 class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('heading', { level: 2 }) }" title="Heading 2" @click="setHeading(2)">
          <Heading2 class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('bulletList') }" title="Bullet list" @click="toggleBulletList">
          <List class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('orderedList') }" title="Ordered list" @click="toggleOrderedList">
          <ListOrdered class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('blockquote') }" title="Quote" @click="toggleBlockquote">
          <Quote class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('codeBlock') }" title="Code block" @click="toggleCode">
          <Code class="w-3 h-3" />
        </button>
        <div class="divider divider-horizontal mx-1"/>
        <button class="btn btn-xs btn-ghost" :disabled="!canUndo" title="Undo" @click="undo">
          <Undo class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :disabled="!canRedo" title="Redo" @click="redo">
          <Redo class="w-3 h-3" />
        </button>
        <div class="flex-1"/>
        <button class="btn btn-xs btn-primary gap-1" @click="save">
          <Save :size="12" />
          {{ t('ext.ka.notes.save', 'Save') }}
        </button>
      </div>
    </div>

    <!-- Editor content -->
    <div class="flex-1 overflow-auto">
      <EditorContent :editor="editor" />
    </div>

    <!-- Footer: word count + reading time -->
    <div class="border-t border-base-300 px-3 py-1.5 flex items-center gap-3 text-[11px] text-base-content/50">
      <span class="inline-flex items-center gap-1">
        <TypeIcon :size="11" />
        {{ t('ext.ka.notes.words', '{count} words').replace('{count}', String(wordCount)) }}
      </span>
      <span class="inline-flex items-center gap-1">
        <Clock3 :size="11" />
        {{ t('ext.ka.notes.readingTime', '{min} min read').replace('{min}', String(readingMinutes)) }}
      </span>
    </div>
  </div>
</template>
