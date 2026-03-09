import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'file_cleanup_errors' })
export class FileCleanupErrorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_uri', type: 'varchar' })
  fileUri: string;

  @Column({ name: 'driver', type: 'varchar' })
  driver: 'local' | 's3' | 's3-presigned';

  @Column({ name: 'attempts', type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
