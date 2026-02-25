---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/extension.module.ts
before: from '@nestjs/common'
skip_if: forwardRef,
---
<% if (kind === 'reference' || kind === 'duplication') { -%>
  <% if (referenceType === 'oneToMany' || (referenceType === 'manyToOne' && propertyInReference)) { -%>
    forwardRef,
  <% } -%>
<% } -%>
