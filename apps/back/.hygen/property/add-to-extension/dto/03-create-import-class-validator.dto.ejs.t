---
inject: true
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
at_line: 0
skip_if: IsEnum,
---
<% if (isAddToDto) { -%>
import {
} from 'class-validator';
<% } -%>
