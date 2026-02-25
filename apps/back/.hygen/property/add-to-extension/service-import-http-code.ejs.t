---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>.service.ts
before: from '@nestjs/common'
skip_if: HttpStatus,
---
<% if (kind === 'reference' || kind === 'duplication') { -%>
  HttpStatus,
  UnprocessableEntityException,
<% } -%>