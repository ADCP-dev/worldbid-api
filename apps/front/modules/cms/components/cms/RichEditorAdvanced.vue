<script setup lang="ts">
import { EditorContent, useEditor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link as LinkIcon,
  Link2Off,
  Undo,
  Redo,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  Table,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Merge,
  SplitSquareHorizontal,
} from "lucide-vue-next";
import { fetchWrapper } from "@/helpers/fetch-wrapper";
import { useAuthStore } from "#imports";

const props = defineProps({
  modelValue: String,
  class: String,
  entityName: {
    type: String,
    default: undefined,
  },
  entityId: {
    type: String,
    default: undefined,
  },
  uploadUrl: {
    type: String,
    default: "/api/v1/cms/media/upload",
  },
});

const emit = defineEmits(["update:modelValue"]);

const isUploading = ref(false);
const showTableModal = ref(false);
const tableRows = ref(3);
const tableCols = ref(3);
const tableWithHeader = ref(true);
const fileInput = ref<HTMLInputElement | null>(null);

const editor = useEditor({
  content: props.modelValue || "",
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: "text-primary underline",
      },
    }),
    Image.configure({
      inline: false,
      HTMLAttributes: {
        class: "rounded-lg max-w-full",
      },
    }),
    Placeholder.configure({
      placeholder: "Escribe tu contenido aquí...",
    }),
    Highlight.configure({
      multicolor: true,
    }),
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    Typography,
  ],
  injectCSS: false,
  editorProps: {
    attributes: {
      class:
        "prose prose-sm sm:prose-base lg:prose-lg m-4 focus:outline-none dark:prose-invert max-w-none min-h-[350px]",
    },
    handleDrop: function (view, event, slice, moved) {
      if (
        !moved &&
        event.dataTransfer &&
        event.dataTransfer.files &&
        event.dataTransfer.files[0]
      ) {
        const file = event.dataTransfer.files[0];
        if (file.type.startsWith("image/")) {
          event.preventDefault();
          uploadImage(file);
          return true;
        }
      }
      return false;
    },
    handlePaste: function (view, event) {
      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              uploadImage(file);
            }
            return true;
          }
        }
      }
      return false;
    },
  },
  onUpdate({ editor }) {
    emit("update:modelValue", editor.getHTML());
  },
});

async function uploadImage(file: File) {
  if (isUploading.value) return;

  const authStore = useAuthStore();
  if (!authStore.token) {
    console.error("No authentication token available");
    return;
  }

  isUploading.value = true;
  try {
    const runtimeConfig = useRuntimeConfig();
    const base = runtimeConfig.public.apiUrl;

    const formData = new FormData();
    formData.append("file", file);

    if (props.entityName) {
      formData.append("entityName", props.entityName);
    }
    if (props.entityId) {
      formData.append("entityId", props.entityId);
    }
    formData.append("context", "content");

    const response = await fetch(`${base}/api/v1/cms/media/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Upload failed:", response.status, text);
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.url && editor.value) {
      editor.value.chain().focus().setImage({ src: result.url }).run();
    }
  } catch (error) {
    console.error("Error uploading image:", error);
  } finally {
    isUploading.value = false;
  }
}

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

function addImage() {
  fileInput.value?.click();
}

function onFileSelected(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file && file.type.startsWith("image/")) {
    uploadImage(file);
  }
  target.value = "";
}

function insertHorizontalRule() {
  if (editor.value) {
    editor.value.chain().focus().setHorizontalRule().run();
  }
}

function insertTable() {
  if (editor.value) {
    editor.value
      .chain()
      .focus()
      .insertTable({
        rows: tableRows.value,
        cols: tableCols.value,
        withHeaderRow: tableWithHeader.value,
      })
      .run();
    showTableModal.value = false;
  }
}

function setTextColor() {
  const color = prompt("Ingrese el color (hex):", "#");
  if (color && editor.value) {
    editor.value.chain().focus().setColor(color).run();
  }
}

function clearHighlighting() {
  if (editor.value) {
    editor.value.chain().focus().unsetHighlight().run();
  }
}
</script>

<template>
  <div :class="[props.class, 'form-control w-full']">
    <!-- Toolbar -->
    <div
      v-if="editor"
      class="flex flex-wrap gap-1 items-center mb-2 bg-base-200 p-2 rounded-t-lg border-x border-t"
    >
      <!-- Basic Formatting -->
      <div class="join">
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('bold') }"
          title="Negrita (Ctrl+B)"
          @click="editor.chain().focus().toggleBold().run()"
        >
          <Bold class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('italic') }"
          title="Cursiva (Ctrl+I)"
          @click="editor.chain().focus().toggleItalic().run()"
        >
          <Italic class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('strike') }"
          title="Tachado"
          @click="editor.chain().focus().toggleStrike().run()"
        >
          <Strikethrough class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('code') }"
          title="Código inline"
          @click="editor.chain().focus().toggleCode().run()"
        >
          <Code class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('highlight') }"
          title="Resaltar texto"
          @click="editor.chain().focus().toggleHighlight().run()"
        >
          <Highlighter class="w-4 h-4" />
        </button>
      </div>

      <div class="divider divider-horizontal mx-1 h-8"/>

      <!-- Headings -->
      <div class="join">
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{
            'btn-active bg-base-300': editor.isActive('heading', { level: 1 }),
          }"
          title="Título 1"
          @click="editor.chain().focus().toggleHeading({ level: 1 }).run()"
        >
          <Heading1 class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{
            'btn-active bg-base-300': editor.isActive('heading', { level: 2 }),
          }"
          title="Título 2"
          @click="editor.chain().focus().toggleHeading({ level: 2 }).run()"
        >
          <Heading2 class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{
            'btn-active bg-base-300': editor.isActive('heading', { level: 3 }),
          }"
          title="Título 3"
          @click="editor.chain().focus().toggleHeading({ level: 3 }).run()"
        >
          <Heading3 class="w-4 h-4" />
        </button>
      </div>

      <div class="divider divider-horizontal mx-1 h-8"/>

      <!-- Lists -->
      <div class="join">
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{ 'btn-active bg-base-300': editor.isActive('bulletList') }"
          title="Lista con viñetas"
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

      <div class="divider divider-horizontal mx-1 h-8"/>

      <!-- Block elements -->
      <div class="join">
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
          title="Bloque de código"
          @click="editor.chain().focus().toggleCodeBlock().run()"
        >
          <Code2 class="w-4 h-4" />
        </button>
      </div>

      <div class="divider divider-horizontal mx-1 h-8"/>

      <!-- Text Alignment -->
      <div class="join">
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{
            'btn-active bg-base-300': editor.isActive({ textAlign: 'left' }),
          }"
          title="Alinear a la izquierda"
          @click="editor.chain().focus().setTextAlign('left').run()"
        >
          <AlignLeft class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{
            'btn-active bg-base-300': editor.isActive({ textAlign: 'center' }),
          }"
          title="Centrar"
          @click="editor.chain().focus().setTextAlign('center').run()"
        >
          <AlignCenter class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{
            'btn-active bg-base-300': editor.isActive({ textAlign: 'right' }),
          }"
          title="Alinear a la derecha"
          @click="editor.chain().focus().setTextAlign('right').run()"
        >
          <AlignRight class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :class="{
            'btn-active bg-base-300': editor.isActive({ textAlign: 'justify' }),
          }"
          title="Justificar"
          @click="editor.chain().focus().setTextAlign('justify').run()"
        >
          <AlignJustify class="w-4 h-4" />
        </button>
      </div>

      <div class="divider divider-horizontal mx-1 h-8"/>

      <!-- Link & Image -->
      <div class="join">
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          title="Insertar enlace"
          @click="setLink"
        >
          <LinkIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :disabled="!editor.isActive('link')"
          title="Quitar enlace"
          @click="unsetLink"
        >
          <Link2Off class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          title="Insertar imagen desde archivo"
          @click="addImage"
        >
          <ImageIcon class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          title="Línea horizontal"
          @click="insertHorizontalRule"
        >
          <Minus class="w-4 h-4" />
        </button>
      </div>

      <div class="divider divider-horizontal mx-1 h-8"/>

      <!-- Clear formatting -->
      <div class="join">
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          title="Limpiar formato de texto"
          @click="editor.chain().focus().unsetAllMarks().run()"
        >
          <Trash2 class="w-4 h-4" />
        </button>
      </div>

      <div class="divider divider-horizontal mx-1 h-8"/>

      <!-- Undo/Redo -->
      <div class="join">
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :disabled="!editor.can().undo()"
          title="Deshacer (Ctrl+Z)"
          @click="editor.chain().focus().undo().run()"
        >
          <Undo class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost join-item"
          :disabled="!editor.can().redo()"
          title="Rehacer (Ctrl+Shift+Z)"
          @click="editor.chain().focus().redo().run()"
        >
          <Redo class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Table Modal -->
    <dialog :class="{ 'modal modal-open': showTableModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Insertar Tabla</h3>
        <div class="py-4 space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Filas</span>
            </label>
            <input
              v-model.number="tableRows"
              type="number"
              min="1"
              max="10"
              class="input input-bordered"
            >
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text">Columnas</span>
            </label>
            <input
              v-model.number="tableCols"
              type="number"
              min="1"
              max="10"
              class="input input-bordered"
            >
          </div>
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text">Con fila de encabezado</span>
              <input
                v-model="tableWithHeader"
                type="checkbox"
                class="checkbox"
              >
            </label>
          </div>
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="insertTable">Insertar</button>
          <button class="btn" @click="showTableModal = false">Cancelar</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Loading overlay -->
    <div
      v-if="isUploading"
      class="absolute inset-0 bg-base-100/50 flex items-center justify-center z-10"
    >
      <span class="loading loading-spinner loading-lg"/>
    </div>

    <!-- Hidden file input for image upload -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileSelected"
    >

    <!-- Editor content -->
    <div class="rounded-b-lg border bg-base-100 overflow-hidden relative">
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>

<style>
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: hsl(var(--bc) / 0.4);
  pointer-events: none;
  height: 0;
}
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
.prose img {
  border-radius: 0.5rem;
  max-width: 100%;
  height: auto;
}
.prose mark {
  background-color: #faf594;
  border-radius: 0.2rem;
  padding: 0.1rem 0.2rem;
}
.prose table {
  border-collapse: collapse;
  margin: 1rem 0;
  width: 100%;
}
.prose table td,
.prose table th {
  border: 1px solid hsl(var(--bc) / 0.2);
  padding: 0.5rem;
  text-align: left;
}
.prose table th {
  background: hsl(var(--b2));
  font-weight: bold;
}
</style>
