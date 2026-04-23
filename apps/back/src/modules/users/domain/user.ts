import { Exclude, Expose, Type } from 'class-transformer';
import { FileType } from '@storage/files/domain/file';
import { Role } from '@iam/roles/domain/role';
import { Status } from '../statuses/domain/status';
import { ApiProperty } from '@nestjs/swagger';

const idType = Number;

export class User {
  @ApiProperty({
    type: idType,
  })
  @Expose()
  id: number | string;

  @ApiProperty({
    type: String,
    example: 'john.doe@example.com',
  })
  @Expose({ groups: ['me', 'admin'] })
  email: string | null;

  @Exclude({ toPlainOnly: true })
  password?: string;

  @ApiProperty({
    type: String,
    example: 'email',
  })
  @Expose({ groups: ['me', 'admin'] })
  provider: string;

  @ApiProperty({
    type: String,
    example: '1234567890',
  })
  @Expose({ groups: ['me', 'admin'] })
  socialId?: string | null;

  @ApiProperty({
    type: String,
    example: 'John',
  })
  @Expose()
  firstName: string | null;

  @ApiProperty({
    type: String,
    example: 'Doe',
  })
  @Expose()
  lastName: string | null;

  @ApiProperty({
    type: () => FileType,
    description: 'Profile photo, resolved via the polymorphic file system',
    required: false,
  })
  @Type(() => FileType)
  @Expose()
  photo?: FileType | null;

  @ApiProperty({
    type: () => Role,
  })
  @Type(() => Role)
  @Expose()
  role?: Role | null;

  @ApiProperty({
    type: () => Status,
  })
  @Type(() => Status)
  @Expose()
  status?: Status;

  @ApiProperty({
    type: String,
    example: '1234567890',
  })
  @Expose()
  stripeCustomerId?: string | null;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty()
  @Expose()
  deletedAt: Date;
}
