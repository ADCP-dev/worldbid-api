<script setup lang="ts">
import { EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

// Props for initial content
const props = defineProps({
  modelValue: String, // Initial content
  class: String,
});

// Emit events for changes
const emit = defineEmits(["update:modelValue"]);

// Define the editor instance
const editor = useEditor({
  content: props.modelValue || "<p>Empieza a escribir aquí...</p>",
  extensions: [
    StarterKit,
    Link.configure({
      openOnClick: false,
    }),
  ],
  injectCSS: false,
  editorProps: {
    attributes: {
      class:
        "prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none dark:prose-invert",
    },
  },
  onUpdate({ editor }) {
    // Emit content changes to the parent
    emit("update:modelValue", editor.getHTML());
  },
});

// Toolbar button styles
const baseButtonClasses =
  "px-3 py-1 text-sm border border-zinc-300 rounded hover:bg-zinc-100 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100";
const activeButtonClasses = "bg-zinc-300 font-semibold dark:bg-zinc-600";
const inactiveButtonClasses = "bg-white dark:bg-zinc-800";

// Link management methods
function setLink() {
  const url = prompt("Ingrese la URL del enlace:");
  if (url) {
    editor?.value.chain().focus().setLink({ href: url }).run();
  }
}

function unsetLink() {
  editor?.value.chain().focus().unsetLink().run();
}
</script>

<template>
  <div :class="props.class">
    <!-- Toolbar Menu -->
    <div v-if="editor" class="flex flex-wrap gap-2 items-center mb-4 menu-bar">
      <!-- Negrita -->
      <button
        type="button"
        :class="[
          baseButtonClasses,
          editor.isActive('bold') ? activeButtonClasses : inactiveButtonClasses,
        ]"
        @click="editor.chain().focus().toggleBold().run()"
      >
        Negrita
      </button>

      <!-- Cursiva -->
      <button
        type="button"
        :class="[
          baseButtonClasses,
          editor.isActive('italic')
            ? activeButtonClasses
            : inactiveButtonClasses,
        ]"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        Cursiva
      </button>

      <!-- Heading Level Buttons -->
      <button
        type="button"
        :class="[
          baseButtonClasses,
          editor.isActive('heading', { level: 1 })
            ? activeButtonClasses
            : inactiveButtonClasses,
        ]"
        @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
      >
        Título 1
      </button>
      <button
        type="button"
        :class="[
          baseButtonClasses,
          editor.isActive('heading', { level: 2 })
            ? activeButtonClasses
            : inactiveButtonClasses,
        ]"
        @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        Título 2
      </button>

      <!-- Lists -->
      <button
        type="button"
        :class="[
          baseButtonClasses,
          editor.isActive('bulletList')
            ? activeButtonClasses
            : inactiveButtonClasses,
        ]"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        Lista desordenada
      </button>
      <button
        type="button"
        :class="[
          baseButtonClasses,
          editor.isActive('orderedList')
            ? activeButtonClasses
            : inactiveButtonClasses,
        ]"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        Lista ordenada
      </button>

      <!-- Cita -->
      <button
        type="button"
        :class="[
          baseButtonClasses,
          editor.isActive('blockquote')
            ? activeButtonClasses
            : inactiveButtonClasses,
        ]"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >
        Cita
      </button>

      <!-- Código -->
      <button
        type="button"
        :class="[
          baseButtonClasses,
          editor.isActive('codeBlock')
            ? activeButtonClasses
            : inactiveButtonClasses,
        ]"
        @click="editor.chain().focus().toggleCodeBlock().run()"
      >
        Código
      </button>

      <!-- Enlace -->
      <button
        type="button"
        :class="[baseButtonClasses, inactiveButtonClasses]"
        @click="setLink"
      >
        Enlace
      </button>
      <button
        type="button"
        :class="[baseButtonClasses, inactiveButtonClasses]"
        @click="unsetLink"
      >
        Quitar enlace
      </button>

      <!-- Undo/Redo -->
      <button
        type="button"
        :class="[baseButtonClasses, inactiveButtonClasses]"
        @click="editor.chain().focus().undo().run()"
      >
        Deshacer
      </button>
      <button
        type="button"
        :class="[baseButtonClasses, inactiveButtonClasses]"
        @click="editor.chain().focus().redo().run()"
      >
        Rehacer
      </button>
    </div>

    <!-- Editor Content -->
    <div class="rounded-md border border-zinc-300 dark:border-zinc-700">
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>
