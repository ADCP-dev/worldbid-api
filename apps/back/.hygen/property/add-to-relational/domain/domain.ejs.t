---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/domain/<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.ts
after: export class <%= name %> {
---
<% if (kind === 'primitive') { -%>
<% if (isAddToDto) { -%>
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
    ,
    nullable: <%= isNullable %>,
  })
  @Expose()
<% } else { -%>
  @Expose()
<% } -%>
<% if (type === 'json' || type === 'jsonb') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: Record<string, any> <% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'array') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: string <% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'enum') { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: string <% if (isNullable) { -%> | null<% } -%>;
<% } else { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %> <% if (isNullable) { -%> | null<% } -%>;
<% } -%>
<% } else if (kind === 'reference' || kind === 'duplication') { -%>
<% if (isAddToDto) { -%>
  @ApiProperty({
    type: () => <%= type %>,
    nullable: <%= isNullable %>,
  })
<% } -%>
  @Expose()
  @Type(() => <%= type %>)
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %><% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>[]<% } -%> <% if (isNullable) { -%> | null<% } -%>;
<% } -%>
