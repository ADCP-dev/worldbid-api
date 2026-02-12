import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { UserEntity } from '../../../../../users/infrastructure/persistence/relational/entities/user.entity';

@Entity({ name: 'file' })
export class FileEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  path: string;

  @Column()
  name: string;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ nullable: true })
  entity?: string;

  @Column({ nullable: true })
  entityId?: string;

  @ManyToOne(() => UserEntity)
  user?: UserEntity | null;

  @Column({ nullable: true })
  userId?: number;

  @Column()
  type: string;

  @Column({ type: 'bigint' })
  size: number;
}
