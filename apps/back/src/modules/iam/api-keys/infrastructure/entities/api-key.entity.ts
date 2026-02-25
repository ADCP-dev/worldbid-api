import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '@users/infrastructure/entities/user.entity';
import { EntityRelationalHelper } from '@infra/utils/relational-entity-helper';

@Entity({
  name: 'api_key',
})
export class ApiKeyEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: String, unique: true })
  key: string;

  @ManyToOne(() => UserEntity, {
    eager: false,
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
