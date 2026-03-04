---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity.ts
at_line: 0
skip_if: __skip_entity_import__
---
<% if (kind === 'reference' || kind === 'duplication') { -%>
  import { <%= type %>Entity } from '../../../<%= h.inflection.transform(type, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/entities/<%= h.inflection.transform(type, ['underscore', 'dasherize']) %>.entity';
<% } -%>