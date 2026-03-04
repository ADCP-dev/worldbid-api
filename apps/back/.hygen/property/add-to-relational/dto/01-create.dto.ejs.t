---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
after: export class Create<%= name %>Dto
---

<% if (isAddToDto && kind === 'primitive') { -%>
<% if (type === 'string' || type === 'text') { -%>
  @ApiProperty({ required: <%= !(isOptional || isNullable) %>, type: String })
  <% if (isOptional || isNullable) { -%>
  @IsOptional()
  <% } -%>
  @IsString()
  <%= property %><% if (isOptional) { -%>?<% } -%>: string<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'uuid') { -%>
  @ApiProperty({ required: <%= !(isOptional || isNullable) %>, type: String })
  <% if (isOptional || isNullable) { -%>
  @IsOptional()
  <% } -%>
  @IsUUID()
  <%= property %><% if (isOptional) { -%>?<% } -%>: string<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'enum') { -%>
  @ApiProperty({ required: <%= !(isOptional || isNullable) %>, type: String })
  <% if (isOptional || isNullable) { -%>
  @IsOptional()
  <% } -%>
  @IsEnum(Object)
  <%= property %><% if (isOptional) { -%>?<% } -%>: string<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'number' || type === 'decimal') { -%>
  @ApiProperty({ required: <%= !(isOptional || isNullable) %>, type: Number })
  <% if (isOptional || isNullable) { -%>
  @IsOptional()
  <% } -%>
  @IsNumber()
  <%= property %><% if (isOptional) { -%>?<% } -%>: number<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'boolean') { -%>
  @ApiProperty({ required: <%= !(isOptional || isNullable) %>, type: Boolean })
  <% if (isOptional || isNullable) { -%>
  @IsOptional()
  <% } -%>
  @IsBoolean()
  <%= property %><% if (isOptional) { -%>?<% } -%>: boolean<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'Date' || type === 'timestamp') { -%>
  @ApiProperty({ required: <%= !(isOptional || isNullable) %>, type: Date })
  <% if (isOptional || isNullable) { -%>
  @IsOptional()
  <% } -%>
  @Transform(({ value }) => value ? new Date(value) : null)
  @IsDate()
  <%= property %><% if (isOptional) { -%>?<% } -%>: Date<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'json' || type === 'jsonb') { -%>
  @ApiProperty({ required: <%= !(isOptional || isNullable) %>, type: Object })
  <% if (isOptional || isNullable) { -%>
  @IsOptional()
  <% } -%>
  @ValidateNested()
  @Type(() => Object)
  <%= property %><% if (isOptional) { -%>?<% } -%>: Record<string, any><% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'array') { -%>
  @ApiProperty({ required: <%= !(isOptional || isNullable) %>, type: [String] })
  <% if (isOptional || isNullable) { -%>
  @IsOptional()
  <% } -%>
  @IsString()
  <%= property %><% if (isOptional) { -%>?<% } -%>: string<% if (isNullable) { -%> | null<% } -%>;
<% } -%>
<% } -%>
