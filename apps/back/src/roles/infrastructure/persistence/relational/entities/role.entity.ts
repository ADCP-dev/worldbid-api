import { Column, Entity, JoinTable, ManyToMany, PrimaryColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { PermissionEntity } from '../../../../../permissions/infrastructure/persistence/relational/entities/permission.entity';

@Entity({
  name: 'role',
})
export class RoleEntity extends EntityRelationalHelper {
  @PrimaryColumn()
  id: number;

  @Column()
  name?: string;

  @ManyToMany(() => PermissionEntity, (permission) => permission.id, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinTable({
    name: 'role_permissions',
  })
  permissions: PermissionEntity[];
}
