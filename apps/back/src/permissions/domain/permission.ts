import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { Role } from '../../roles/domain/role';

const idType = Number;

export class Permission {
  @Allow()
  @ApiProperty({
    type: idType,
  })
  id: number | string;

  @Allow()
  @ApiProperty({
    type: String,
    example: 'approve:content',
  })
  name?: string;

  @Allow()
  @ApiProperty({
    type: [Role],
  })
  roles?: Role[];
}
