---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/entities/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.entity.ts
at_line: 0
skip_if: <% if (kind === 'reference' || kind === 'duplication') { -%>import { <%= type %>Entity<% } else { -%><%= true %><% } -%>
---
<% if (kind === 'reference' || kind === 'duplication') { -%>
  import { <%= type %>Entity } from '../../../../../<%= h.inflection.transform(type, ['pluralize', 'underscore', 'dasherize']) %>/infrastructure/entities/<%= h.inflection.transform(type, ['underscore', 'dasherize']) %>.entity';
<% } -%>