---
inject: true
to: src/custom/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/create-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
at_line: 0
skip_if: IsEnum,
---
<% if (isAddToDto && kind === 'primitive') { -%>
  <% if (type === 'json' || type === 'jsonb') { -%>
import { IsOptional, ValidateNested } from 'class-validator';
  <% } else if (type === 'enum') { -%>
import { IsOptional, IsEnum } from 'class-validator';
  <% } else if (type === 'uuid') { -%>
import { IsOptional, IsUUID } from 'class-validator';
  <% } else if (isOptional || isNullable) { -%>
import {
  IsString, IsNumber, IsBoolean, IsDate, IsOptional,
} from 'class-validator';
  <% } else { -%>
import {
  IsString, IsNumber, IsBoolean, IsDate,
} from 'class-validator';
  <% } -%>
<% } -%>
<% if (isAddToDto && (kind === 'reference' || kind === 'duplication')) { -%>
  <% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
  <% if (isOptional || isNullable) { -%>
import {
  IsUUID, IsArray, IsOptional,
} from 'class-validator';
  <% } else { -%>
import {
  IsUUID, IsArray,
} from 'class-validator';
  <% } -%>
  <% } else { -%>
import {
  IsUUID,
} from 'class-validator';
  <% } -%>
<% } -%>