---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.module.ts
after: imports.*\[
skip_if: __skip_module_import__
---

<% if (kind === 'reference' || kind === 'duplication') { -%>
  <% if (!(referenceType === 'oneToMany' || (referenceType === 'manyToOne' && propertyInReference))) { -%>
    <%= h.inflection.transform(type, ['pluralize']) %>Module,
  <% } -%>
<% } -%>
