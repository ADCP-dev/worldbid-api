<script setup lang="ts">
import { ref, computed } from 'vue';
const content = ref("<h3>Welcome to the Rich Editor</h3><p>This is a <b>modularized</b> rich text editor component.</p><ul><li>Supports lists</li><li>Bold/Italic</li><li>Headings</li></ul>");

const formattedHtml = computed(() => {
  let indent = 0;
  const tab = '  ';
  const blockTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'blockquote', 'pre', 'div'];
  
  return content.value
    // Add newlines around block tags to isolate them
    .replace(new RegExp(`(<(${blockTags.join('|')})[^>]*>)`, 'gi'), '\n$1')
    .replace(new RegExp(`(</(${blockTags.join('|')})>)`, 'gi'), '$1\n')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => {
      line = line.trim();
      let currentIndent = indent;
      
      // If line is ONLY a closing block tag, decrement indent before rendering
      const isClosing = new RegExp(`^</(${blockTags.join('|')})>$`, 'i').test(line);
      if (isClosing) {
        indent--;
        currentIndent = indent;
      }
      
      const indentedLine = tab.repeat(Math.max(0, currentIndent)) + line;
      
      // If line is ONLY an opening block tag (not self-closing, not containing its own closing tag), increment indent for next line
      const isOpening = new RegExp(`^<(${blockTags.join('|')})[^>]*>$`, 'i').test(line);
      if (isOpening && !line.includes('/>')) {
        indent++;
      }
      
      return indentedLine;
    })
    .join('\n')
    .trim();
});
</script>

<template>
    <div class="container mx-auto py-10 px-4">
        <div class="flex flex-col gap-8">
            <div>
                <h1 class="text-3xl font-bold tracking-tight mb-2">Rich Editor Demo</h1>
                <p class="text-base-content/60">
                    Utilizando el componente modularizado RichEditor con Tiptap y daisyUI.
                </p>
            </div>

            <div class="grid gap-8 lg:grid-cols-2">
                <div class="card bg-base-100 shadow-xl border border-base-content/5">
                    <div class="card-body p-8">
                        <h2 class="card-title text-xl mb-4">Editor</h2>
                        <RichEditor v-model="content" class="min-h-[400px] border rounded-xl overflow-hidden" />
                    </div>
                </div>

                <div class="card bg-base-100 shadow-xl border border-base-content/5">
                    <div class="card-body p-8">
                        <h2 class="card-title text-xl mb-4">Preview</h2>
                        <div class="prose max-w-none p-6 border rounded-xl min-h-[400px] bg-base-200/30">
                            <div v-html="content"/>
                        </div>
                        
                        <div class="mt-8">
                            <h4 class="text-sm font-bold mb-3 uppercase tracking-wider opacity-60">Raw HTML</h4>
                            <div class="mockup-code text-xs">
                              <pre class="overflow-auto max-h-[200px] px-4"><code>{{ formattedHtml }}</code></pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="alert alert-success shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>El editor se sincroniza automáticamente mediante v-model con la vista de previsualización.</span>
            </div>
        </div>
    </div>
</template>
