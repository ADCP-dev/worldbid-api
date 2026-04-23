---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.ts
at_line: 0
skip_if: import { Expose }
---
<% if (kind === 'reference' || kind === 'duplication') { -%>
import { Type } from 'class-transformer';
import { <%= type %><% if (type === 'File') { -%>Type<% } -%> } from '../../<%= h.inflection.transform(type, ['pluralize', 'underscore', 'dasherize']) %>/domain/<%= h.inflection.transform(type, ['underscore', 'dasherize']) %>';
<% } else { -%>
<% } -%>