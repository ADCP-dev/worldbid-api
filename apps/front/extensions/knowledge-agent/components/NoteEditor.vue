<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Wikilink } from './WikilinkExtension';
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
  Link2,
} from 'lucide-vue-next';
import TagsChipsInput from './TagsChipsInput.vue';
import WikilinkPicker from './WikilinkPicker.vue';

const props = defineProps<{
  modelValue: string;
  title: string;
  categoryPath?: string | null;
  tags?: string[];
  /** List of existing category paths for the category selector. */
  categories?: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:title': [value: string];
  'update:categoryPath': [value: string];
  'update:tags': [value: string[]];
  save: [];
  /** Emitted when the user asks to create a new category from the selector. */
  createCategory: [name: string];
}>();

const { t } = useI18n();

const editor = useEditor({
  content: props.modelValue || '<p></p>',
  extensions: [
    StarterKit,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'ka-wikilink text-primary underline decoration-dotted hover:decoration-solid',
      },
    }),
    Wikilink,
  ],
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

/* ── Breadcrumbs from dotted categoryPath ── */
const breadcrumbs = computed<string[]>(() => {
  const cp = (props.categoryPath ?? '').split('.').map((s) => s.trim()).filter(Boolean);
  return cp.length > 0 ? cp : [t('ext.ka.notes.uncategorized', 'uncategorized')];
});

/* ── Category select with "new category" option ── */
const categoryOptions = computed(() => {
  const cats = props.categories ?? [];
  return [
    { label: t('ext.ka.notes.noCategory', '— No category —'), value: '' },
    ...cats.map((c) => ({ label: c, value: c })),
    { label: `+ ${t('ext.ka.notes.newCategory', 'New category…')}`, value: '__new__' },
  ];
});

const showNewCategoryInput = ref(false);
const newCategoryName = ref('');

function onCategoryChange(value: string): void {
  if (value === '__new__') {
    showNewCategoryInput.value = true;
    newCategoryName.value = '';
    return;
  }
  localCategoryPath.value = value;
}

function confirmNewCategory(): void {
  const name = newCategoryName.value.trim();
  if (!name) return;
  emit('createCategory', name);
  localCategoryPath.value = name;
  showNewCategoryInput.value = false;
  newCategoryName.value = '';
}

/* ── Character count with warning threshold ── */
const charCount = computed(() => {
  const text = editor.value?.getText() ?? '';
  return text.length;
});
/** Above this many chars the UI warns the note is too long for single-file AI search. */
const CHAR_WARN_THRESHOLD = 4000;
const charWarn = computed(() => charCount.value > CHAR_WARN_THRESHOLD);

/* ── Wikilink picker ── */
const wikilinkPickerOpen = ref(false);
const toolbarRef = ref<HTMLElement | null>(null);

function toggleWikilinkPicker(): void {
  wikilinkPickerOpen.value = !wikilinkPickerOpen.value;
}

function insertWikilink(note: { title: string }): void {
  if (!editor.value) return;
  // Insert as a wikilink node — renders as [[title]] link in the editor.
  editor.value.chain().focus().insertWikilink(note.title).insertContent(' ').run();
  wikilinkPickerOpen.value = false;
}

/* ── Toolbar actions ── */
const canUndo = computed(() => editor.value?.can().chain().focus().undo().run() ?? false);
const canRedo = computed(() => editor.value?.can().chain().focus().redo().run() ?? false);

function setHeading(level: 1 | 2) { editor.value?.chain().focus().toggleHeading({ level }).run(); }
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

      <!-- Category select (replaces raw input) + new category input -->
      <div v-if="!showNewCategoryInput" class="flex items-center gap-2">
        <select
          :value="localCategoryPath"
          class="select select-sm select-bordered flex-1 font-mono"
          @change="onCategoryChange(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
      <div v-else class="flex items-center gap-2">
        <input
          v-model="newCategoryName"
          type="text"
          :placeholder="t('ext.ka.notes.newCategoryPlaceholder', 'e.g. tech.notes.async')"
          class="input input-sm input-bordered flex-1 font-mono"
          @keyup.enter="confirmNewCategory"
        >
        <button class="btn btn-xs btn-primary" @click="confirmNewCategory">
          {{ t('ext.ka.notes.addCategory', 'Add') }}
        </button>
        <button class="btn btn-xs btn-ghost" @click="showNewCategoryInput = false">
          {{ t('ext.ka.settings.cancel', 'Cancel') }}
        </button>
      </div>

      <!-- Tags chips -->
      <TagsChipsInput v-model="localTags" />

      <!-- Toolbar with wikilink button -->
      <div ref="toolbarRef" class="flex flex-wrap items-center gap-1 pt-1 relative">
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
        <!-- Wikilink button -->
        <button
          class="btn btn-xs btn-ghost gap-1"
          :class="{ 'btn-active': wikilinkPickerOpen }"
          :title="t('ext.ka.notes.insertLink', 'Insert note link [[ ]]')"
          @click="toggleWikilinkPicker"
        >
          <Link2 class="w-3 h-3" />
          <span class="text-xs">[[ ]]</span>
        </button>
        <WikilinkPicker
          :open="wikilinkPickerOpen"
          @select="insertWikilink"
          @close="wikilinkPickerOpen = false"
        />
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

    <!-- Footer: character count with warning -->
    <div class="border-t border-base-300 px-3 py-1.5 flex items-center gap-2 text-[11px]">
      <span :class="charWarn ? 'text-warning font-semibold' : 'text-base-content/50'">
        {{ t('ext.ka.notes.charCount', '{count} chars').replace('{count}', String(charCount)) }}
      </span>
      <span v-if="charWarn" class="text-warning/80">
        {{ t('ext.ka.notes.charWarn', 'Long note — consider splitting for better AI search') }}
      </span>
    </div>
  </div>
</template>