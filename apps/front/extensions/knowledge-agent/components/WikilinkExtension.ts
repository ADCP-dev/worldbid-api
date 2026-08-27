/**
 * TipTap Wikilink extension — renders [[note title]] as a clickable link
 * inside the editor. The node stores the note title as an attribute and
 * renders as <a class="ka-wikilink" href="#note:TITLE">[[TITLE]]</a>.
 *
 * The backend's LINK_PATTERN = /\[\[([^\]]+)\]\]/g still matches the raw
 * [[title]] text in the HTML output because the node's HTML serialization
 * preserves the [[ ]] delimiters.
 */
import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikilink: {
      insertWikilink: (title: string) => ReturnType;
    };
  }
}

export interface WikilinkOptions {
  HTMLAttributes: Record<string, string>;
}

export const Wikilink = Node.create<WikilinkOptions>({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') ?? el.textContent ?? '',
        renderHTML: (attrs) => ({ 'data-title': attrs.title as string }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-type="wikilink"]',
      },
      // Also parse raw [[title]] from pasted text (best-effort)
      // TipTap doesn't parse text content into nodes by default, so this
      // only handles pre-existing <a data-type="wikilink"> tags.
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const title = (HTMLAttributes['data-title'] as string) ?? '';
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'wikilink',
        href: `#note:${encodeURIComponent(title)}`,
        class: 'ka-wikilink text-primary underline decoration-dotted hover:decoration-solid cursor-pointer',
      }),
      `[[${title}]]`,
    ];
  },

  addCommands() {
    return {
      insertWikilink:
        (title: string) =>
        ({ chain }) => {
          return chain().insertContent({
            type: 'wikilink',
            attrs: { title },
          }).run();
        },
    };
  },
});