---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/extension.module.ts
at_line: 0
skip_if: import { <%= h.inflection.transform(type, ['pluralize']) %>Module
---
<% if (kind === 'reference' || kind === 'duplication') { -%>import { <%= h.inflection.transform(type, ['pluralize']) %>Module } from '../<%= h.inflection.transform(type, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(type, ['pluralize', 'underscore', 'dasherize']) %>.module';<% } -%>