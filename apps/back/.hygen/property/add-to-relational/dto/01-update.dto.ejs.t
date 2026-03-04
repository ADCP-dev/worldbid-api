---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/update-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
after: // <update-properties />
---

<% if (isAddToDto && kind === 'primitive') { -%>
<% if (type === 'string' || type === 'text') { -%>
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  <%= property %>?: string<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'uuid') { -%>
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsUUID()
  <%= property %>?: string<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'enum') { -%>
  @ApiProperty({ required: false, type: String })
  @IsOptional()
  @IsEnum(Object)
  <%= property %>?: string<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'number' || type === 'decimal') { -%>
  @ApiProperty({ required: false, type: Number })
  @IsOptional()
  @IsNumber()
  <%= property %>?: number<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'boolean') { -%>
  @ApiProperty({ required: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  <%= property %>?: boolean<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'Date' || type === 'timestamp') { -%>
  @ApiProperty({ required: false, type: Date })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : null)
  @IsDate()
  <%= property %>?: Date<% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'json' || type === 'jsonb') { -%>
  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  <%= property %>?: Record<string, any><% if (isNullable) { -%> | null<% } -%>;
<% } else if (type === 'array') { -%>
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsString()
  <%= property %>?: string<% if (isNullable) { -%> | null<% } -%>;
<% } -%>
<% } -%>
