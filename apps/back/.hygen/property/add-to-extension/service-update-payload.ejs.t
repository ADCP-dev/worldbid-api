---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>.service.ts
after: \<updating\-property\-payload \/\>
---
<% if (kind === 'reference' || kind === 'duplication') { -%>
  <%= property %>,
<% } else { -%>
  <%= property %>: update<%= name %>Dto.<%= property %>,
<% } -%>