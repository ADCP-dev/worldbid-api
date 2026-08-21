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
} from 'lucide-vue-next';

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
  save: [];
}>();

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

watch(() => props.title, (v) => { localTitle.value = v; });
watch(() => props.categoryPath, (v) => { localCategoryPath.value = v ?? ''; });

watch(localTitle, (v) => emit('update:title', v));
watch(localCategoryPath, (v) => emit('update:categoryPath', v));

const canUndo = computed(() => editor.value?.canUndo() ?? false);
const canRedo = computed(() => editor.value?.canRedo() ?? false);

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
    <div class="border-b p-3 space-y-3">
      <input
        v-model="localTitle"
        type="text"
        placeholder="Note title"
        class="input input-bordered w-full text-lg font-semibold"
      />
      <input
        v-model="localCategoryPath"
        type="text"
        placeholder="Category path (e.g. tech.notes.async)"
        class="input input-bordered input-sm w-full"
      />
      <div class="flex flex-wrap gap-1">
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('bold') }" @click="toggleBold" title="Bold">
          <Bold class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('italic') }" @click="toggleItalic" title="Italic">
          <Italic class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('heading', { level: 1 }) }" @click="setHeading(1)" title="Heading 1">
          <Heading1 class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('heading', { level: 2 }) }" @click="setHeading(2)" title="Heading 2">
          <Heading2 class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('bulletList') }" @click="toggleBulletList" title="Bullet list">
          <List class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('orderedList') }" @click="toggleOrderedList" title="Ordered list">
          <ListOrdered class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('blockquote') }" @click="toggleBlockquote" title="Quote">
          <Quote class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :class="{ 'btn-active': editor?.isActive('codeBlock') }" @click="toggleCode" title="Code block">
          <Code class="w-3 h-3" />
        </button>
        <div class="divider divider-horizontal mx-1"></div>
        <button class="btn btn-xs btn-ghost" :disabled="!canUndo" @click="undo" title="Undo">
          <Undo class="w-3 h-3" />
        </button>
        <button class="btn btn-xs btn-ghost" :disabled="!canRedo" @click="redo" title="Redo">
          <Redo class="w-3 h-3" />
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-xs btn-primary" @click="save">Save</button>
      </div>
    </div>
    <div class="flex-1 overflow-auto">
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>