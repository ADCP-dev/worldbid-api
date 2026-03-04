---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.ts
at_line: 0
skip_if: __skip_domain_import__
---
<% if (kind === 'reference' || kind === 'duplication') { -%>import { <%= type %><% if (type === 'File') { -%>Type<% } -%> } from '../../<%= h.inflection.transform(type, ['pluralize', 'underscore', 'dasherize']) %>/domain/<%= h.inflection.transform(type, ['underscore', 'dasherize']) %>';<% } -%>