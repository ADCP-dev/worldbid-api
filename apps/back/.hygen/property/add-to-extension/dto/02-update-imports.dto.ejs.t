---
inject: true
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/dto/update-<%= h.inflection.transform(name, ['underscore', 'dasherize']) %>.dto.ts
after: // <update-imports />
before: export class
---

<%# class-validator imports %>
<% if (isAddToDto) { -%>
<% if (kind === 'primitive') { -%>
<% if (type === 'string' || type === 'text' || type === 'array') { -%>
import { IsString } from 'class-validator';
<% } else if (type === 'uuid') { -%>
import { IsUUID } from 'class-validator';
<% } else if (type === 'number' || type === 'decimal') { -%>
import { IsNumber } from 'class-validator';
<% } else if (type === 'boolean') { -%>
import { IsBoolean } from 'class-validator';
<% } else if (type === 'Date' || type === 'timestamp') { -%>
import { IsDate } from 'class-validator';
<% } else if (type === 'json' || type === 'jsonb') { -%>
import { ValidateNested } from 'class-validator';
<% } else if (type === 'enum') { -%>
import { IsEnum } from 'class-validator';
<% } -%>
<% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
import { IsArray } from 'class-validator';
<% } -%>
import { IsOptional } from 'class-validator';
<% } else if (kind === 'reference' || kind === 'duplication') { -%>
import { IsUUID } from 'class-validator';
<% if (referenceType === 'oneToMany' || referenceType === 'manyToMany') { -%>
import { IsArray } from 'class-validator';
<% } -%>
<% } -%>
<% if (kind === 'primitive' || kind === 'reference' || kind === 'duplication') { -%>
import { ApiProperty } from '@nestjs/swagger';
<% } -%>
<%# class-transformer imports %>
<% if (kind === 'primitive' && (type === 'Date' || type === 'timestamp')) { -%>
import { Transform } from 'class-transformer';
<% } -%>
<% if (kind === 'primitive' && (type === 'json' || type === 'jsonb')) { -%>
import { Type } from 'class-transformer';
<% } -%>
<% } -%>
