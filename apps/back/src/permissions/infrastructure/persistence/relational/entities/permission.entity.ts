import { Column, Entity, JoinTable, ManyToMany, PrimaryColumn } from 'typeorm';
import { EntityRelationalHelper } from '../../../../../utils/relational-entity-helper';
import { RoleEntity } from '../../../../../roles/infrastructure/persistence/relational/entities/role.entity';

@Entity({
  name: 'permission',
})
export class PermissionEntity extends EntityRelationalHelper {
  @PrimaryColumn()
  id: number;

  @Column()
  name?: string;

  @ManyToMany(() => RoleEntity, (role) => role.id, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinTable({
    name: 'role_permissions',
  })
  roles: RoleEntity[];
}
