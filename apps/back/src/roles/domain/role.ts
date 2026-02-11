import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { Permission } from '../../permissions/domain/permission';

const idType = Number;

export class Role {
  @Allow()
  @ApiProperty({
    type: idType,
  })
  id: number | string;

  @Allow()
  @ApiProperty({
    type: String,
    example: 'admin',
  })
  name?: string;

  @Allow()
  @ApiProperty({
    type: [Permission],
  })
  permissions?: Permission[];
}
