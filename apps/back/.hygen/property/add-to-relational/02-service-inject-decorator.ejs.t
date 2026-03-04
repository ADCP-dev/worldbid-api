---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.service.ts
before: __skip_inject_decorator__
skip_if: __skip_inject_decorator__
---
<% if ((kind === 'reference' || kind === 'duplication') && type) { -%>
  <% if (referenceType === 'oneToMany' || (referenceType === 'manyToOne' && !!propertyInReference)) { -%>
    @Inject(forwardRef(() => <%= h.inflection.transform(type, ['pluralize']) %>Service))
  <% } -%>
<% } -%>