---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/extension.module.ts
after: imports.*\[
skip_if: \=\> <%= h.inflection.transform(type, ['pluralize']) %>Module\)?,
---

<% if (kind === 'reference' || kind === 'duplication') { -%>
  <% if (referenceType === 'oneToMany' || (referenceType === 'manyToOne' && propertyInReference)) { -%>
    forwardRef(() => <%= h.inflection.transform(type, ['pluralize']) %>Module),
  <% } -%>
<% } -%>
