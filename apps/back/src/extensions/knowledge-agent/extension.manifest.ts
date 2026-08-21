import type { ExtensionManifest } from '@core/extension-manifest.types';

const manifest: ExtensionManifest = {
  name: 'knowledge-agent',
  version: '1.0.0',
  displayName: 'Knowledge Agent',
  description: 'Knowledge base with markdown notes, pgvector RAG, and graph viewer.',
  author: '',
  engines: {
    foundation: '>=1.0.0',
    node: '>=18.0.0',
  },
  contributes: {
    routes: [
      { method: 'POST', path: 'ka/notes' },
      { method: 'GET', path: 'ka/notes' },
      { method: 'GET', path: 'ka/notes/:id' },
      { method: 'PATCH', path: 'ka/notes/:id' },
      { method: 'DELETE', path: 'ka/notes/:id' },
    ],
    entities: [
      { name: 'Note', table: 'ext_ka_notes' },
      { name: 'NoteLink', table: 'ext_ka_note_links' },
    ],
    seeds: false,
    config: [],
    menuItems: [],
    permissions: [],
  },
};

export default manifest;
export { manifest };