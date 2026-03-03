---
inject: true
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/update-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
after: // <update-properties />
---

<% if (isAddToDto) { -%>
  @ApiProperty({
    required: false,
    type: () => 
      <% if (kind === 'primitive') { -%>
        <% if (type === 'string') { -%>
          String,
        <% } else if (type === 'number') { -%>
          Number,
        <% } else if (type === 'boolean') { -%>
          Boolean,
        <% } else if (type === 'Date') { -%>
          Date,
        <% } -%>
      <% } else if (kind === 'reference' || kind === 'duplication') { -%>
        <% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
          [String],
        <% } else { -%>
          String,
        <% } -%>
      <% } -%>
  })
<% } -%>

<% if (isAddToDto) { -%>
  @IsOptional()
  <% if (kind === 'primitive') { -%>
    <% if (type === 'string') { -%>
      @IsString()
    <% } else if (type === 'number') { -%>
      @IsNumber()
    <% } else if (type === 'boolean') { -%>
      @IsBoolean()
    <% } else if (type === 'Date') { -%>
      @Transform(({ value }) => value ? new Date(value) : null)
      @IsDate()
    <% } -%>
  <% } else if (kind === 'reference' || kind === 'duplication') { -%>
    <% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
      @IsArray()
      @IsUUID('4', { each: true })
    <% } else { -%>
      @IsUUID()
    <% } -%>
  <% } -%>
<% } -%>

<% if (kind === 'reference' || kind === 'duplication') { -%>
  <% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
  <%= property %>Ids<% if (!isAddToDto || isOptional) { -%>?<% } -%>: string[] <% if (isNullable) { -%> | null<% } -%>;
  <% } else { -%>
  <%= property %>Id<% if (!isAddToDto || isOptional) { -%>?<% } -%>: string <% if (isNullable) { -%> | null<% } -%>;
  <% } -%>
<% } else { -%>
  <%= property %><% if (!isAddToDto || isOptional) { -%>?<% } -%>: <%= type %> <% if (isNullable) { -%> | null<% } -%>;
<% } -%>
