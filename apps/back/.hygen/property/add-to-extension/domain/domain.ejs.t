---
inject: true
to: src/extensions/<%= h.inflection.transform(extension, ['pluralize', 'underscore', 'dasherize']) %>/domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.ts
after: export class <%= name %> {
---

<% if (isAddToDto && kind === 'primitive') { -%>
@ApiProperty({
  type: () => 
    <% if (type === 'string' || type === 'text' || type === 'uuid' || type === 'enum') { -%>
      String,
    <% } else if (type === 'number' || type === 'decimal') { -%>
      Number,
    <% } else if (type === 'boolean') { -%>
      Boolean,
    <% } else if (type === 'Date' || type === 'timestamp') { -%>
      Date,
    <% } else if (type === 'json' || type === 'jsonb') { -%>
      Object,
    <% } else if (type === 'array') { -%>
      String,
    <% } else { -%>
      String,
    <% } -%>
  nullable: <%= isNullable %>,
})
<% } -%>

<% if (kind === 'reference' || kind === 'duplication') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %><% if (type === 'File') { -%>Type<% } -%><% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>[]<% } -%> <% if (isNullable) { -%> | null<% } -%>;
<% } else if (kind === 'primitive') { -%>
  <% if (type === 'json' || type === 'jsonb') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: object <% if (isNullable) { -%> | null<% } -%>;
  <% } else if (type === 'array') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: string <% if (isNullable) { -%> | null<% } -%>;
  <% } else if (type === 'enum') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: string <% if (isNullable) { -%> | null<% } -%>;
  <% } else { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %> <% if (isNullable) { -%> | null<% } -%>;
  <% } -%>
<% } else { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %> <% if (isNullable) { -%> | null<% } -%>;
<% } -%>
