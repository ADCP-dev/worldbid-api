---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/update-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
after: // <update-properties />
---

<% if (isAddToDto) { -%>
  @ApiProperty({
    required: false,
    type: () =>
      <% if (kind === 'primitive') { -%>
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
          [String],
        <% } -%>
      <% } else if (kind === 'reference' || kind === 'duplication') { -%>
        <% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
          [String],
        <% } else { -%>
          String,
        <% } -%>
      <% } -%>
  })
  @IsOptional()
  <% if (kind === 'primitive') { -%>
    <% if (type === 'string' || type === 'text') { -%>
      @IsString()
    <% } else if (type === 'uuid') { -%>
      @IsUUID()
    <% } else if (type === 'number' || type === 'decimal') { -%>
      @IsNumber()
    <% } else if (type === 'boolean') { -%>
      @IsBoolean()
    <% } else if (type === 'Date' || type === 'timestamp') { -%>
      @Transform(({ value }) => (value ? new Date(value) : null))
      @IsDate()
    <% } else if (type === 'json' || type === 'jsonb') { -%>
      @ValidateNested()
      @Type(() => Object)
    <% } else if (type === 'array') { -%>
      @IsString()
    <% } else if (type === 'enum') { -%>
      @IsEnum(Object)
    <% } -%>
  <% } else if (kind === 'reference' || kind === 'duplication') { -%>
    <% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
      @IsArray()
      @IsUUID('4', { each: true })
    <% } else { -%>
      @IsUUID()
    <% } -%>
  <% } -%>
  <% if (kind === 'reference' || kind === 'duplication') { -%>
    <% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
  <%= property %>Ids?: string[] <% if (isNullable) { -%> | null<% } -%>;
    <% } else { -%>
  <%= property %>Id?: string <% if (isNullable) { -%> | null<% } -%>;
    <% } -%>
  <% } else if (type === 'json' || type === 'jsonb') { -%>
  <%= property %>?: Record<string, any> <% if (isNullable) { -%> | null<% } -%>;
  <% } else { -%>
  <%= property %>?: <% if (type === 'string' || type === 'text' || type === 'uuid' || type === 'enum' || type === 'array') { -%>string<% } else if (type === 'number' || type === 'decimal') { -%>number<% } else if (type === 'boolean') { -%>boolean<% } else if (type === 'Date' || type === 'timestamp') { -%>Date<% } -%> <% if (isNullable) { -%> | null<% } -%>;
  <% } -%>
<% } -%>
