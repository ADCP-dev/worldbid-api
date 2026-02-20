---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>.service.ts
before: from '@nestjs/common'
skip_if: Inject,
---
<% if (kind === 'reference' || kind === 'duplication') { -%>
  <% if (referenceType === 'oneToMany' || (referenceType === 'manyToOne' && propertyInReference)) { -%>
    Inject,
  <% } -%>
<% } -%>
