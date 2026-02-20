---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>.service.ts
at_line: 0
skip_if: import { <%= type %><% if (type === 'File') { -%>Type<% } -%>
---
<% if (kind === 'reference' || kind === 'duplication') { -%>
  import { <%= type %><% if (type === 'File') { -%>Type<% } -%> } from '../<%= h.inflection.transform(type, ['pluralize', 'underscore', 'dasherize']) %>/domain/<%= h.inflection.transform(type, ['underscore', 'dasherize']) %>';
<% } -%>