<script setup lang="ts">
import { EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Quote, Code, Link as LinkIcon, Link2Off, Undo, Redo } from "lucide-vue-next";

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
        "prose prose-sm sm:prose-base lg:prose-lg m-4 focus:outline-none dark:prose-invert max-w-none min-h-[150px]",
    },
  },
  onUpdate({ editor }) {
    // Emit content changes to the parent
    emit("update:modelValue", editor.getHTML());
  },
});

// Link management methods
function setLink() {
  const url = prompt("Ingrese la URL del enlace:");
  if (url && editor.value) {
    editor.value.chain().focus().setLink({ href: url }).run();
  }
}

function unsetLink() {
  if (editor.value) {
    editor.value.chain().focus().unsetLink().run();
  }
}
</script>

<template>
  <div :class="[props.class, 'form-control w-full']">
    <!-- Toolbar Menu -->
    <div v-if="editor" class="flex flex-wrap gap-1 items-center mb-2 bg-base-200 p-1 rounded-t-lg border-x border-t ">
      <div class="join">
        <!-- Bold -->
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('bold') }"
          title="Negrita"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <Bold class="w-4 h-4" />
        </button>

        <!-- Italic -->
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('italic') }"
          title="Cursiva"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <Italic class="w-4 h-4" />
        </button>
      </div>

      <div class="join ml-1">
        <!-- Headings -->
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('heading', { level: 1 }) }"
          title="Título 1"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          <Heading1 class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('heading', { level: 2 }) }"
          title="Título 2"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <Heading2 class="w-4 h-4" />
        </button>
      </div>

      <div class="join ml-1">
        <!-- Lists -->
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('bulletList') }"
          title="Lista desordenada"
          @click="editor.chain().focus().toggleBulletList().run()"
        >
          <List class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('orderedList') }"
          title="Lista ordenada"
          @click="editor.chain().focus().toggleOrderedList().run()"
        >
          <ListOrdered class="w-4 h-4" />
        </button>
      </div>

      <div class="join ml-1">
        <!-- Quote & Code -->
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('blockquote') }"
          title="Cita"
          @click="editor.chain().focus().toggleBlockquote().run()"
        >
          <Quote class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('codeBlock') }"
          title="Código"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          <Code class="w-4 h-4" />
        </button>
      </div>

      <div class="join ml-1">
        <!-- Links -->
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          title="Enlace"
          @click="setLink"
        >
          <LinkIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          title="Quitar enlace"
          @click="unsetLink"
        >
          <Link2Off class="w-4 h-4" />
        </button>
      </div>

      <div class="join ml-auto">
        <!-- Undo/Redo -->
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          title="Deshacer"
          @click="editor.chain().focus().undo().run()"
        >
          <Undo class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          title="Rehacer"
          @click="editor.chain().focus().redo().run()"
        >
          <Redo class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Editor Content -->
    <div class="rounded-b-lg border  bg-base-100 overflow-hidden">
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>

<style>
/* Tiptap specific styles to match Tailwind Typography if needed */
.prose pre {
  background: hsl(var(--p));
  color: hsl(var(--pc));
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
}

.prose code {
  color: inherit;
  padding: 0;
  background: none;
  font-size: 0.8rem;
}

.prose blockquote {
  padding-left: 1rem;
  border-left: 3px solid hsl(var(--bc) / 0.2);
}
</style>
