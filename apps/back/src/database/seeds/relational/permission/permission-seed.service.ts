import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PermissionEntity } from '../../../../permissions/infrastructure/persistence/relational/entities/permission.entity';
import { Repository } from 'typeorm';
import { PermissionEnum } from '../../../../permissions/permissions.enum';
import { RoleEntity } from '../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { RoleEnum } from '../../../../roles/roles.enum';

@Injectable()
export class PermissionSeedService {
  constructor(
    @InjectRepository(PermissionEntity)
    private permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(RoleEntity)
    private roleRepository: Repository<RoleEntity>,
  ) {}

  async run() {
    const permissionCount = await this.permissionRepository.count();

    if (permissionCount === 0) {
      // Get all permission values from the enum
      const permissionValues = Object.values(PermissionEnum);

      // Create permission entities from the enum values
      const permissions = permissionValues.map((permissionName, index) => {
        return this.permissionRepository.create({
          id: index + 1, // Use index + 1 for sequential IDs
          name: permissionName,
        });
      });

      // Save all permissions to the database
      const savedPermissions =
        await this.permissionRepository.save(permissions);
      console.log(`Created ${savedPermissions.length} permission records`);

      // Now assign permissions to roles based on their intended access levels
      await this.assignPermissionsToRoles(savedPermissions);
    } else {
      console.log(
        `Found ${permissionCount} existing permission records, skipping permission seed`,
      );
    }
  }

  /**
   * Assigns permissions to roles based on the role's access level
   */
  private async assignPermissionsToRoles(
    permissions: PermissionEntity[],
  ): Promise<void> {
    // Find all roles
    const roles = await this.roleRepository.find();

    if (!roles.length) {
      console.log('No roles found to assign permissions to');
      return;
    }

    // Create a map of role ID to permissions
    const rolePermissionsMap = new Map<number, PermissionEntity[]>();

    // Find the admin role
    const adminRole = roles.find((role) => role.id === RoleEnum.admin);
    if (adminRole) {
      // Admin gets all permissions
      rolePermissionsMap.set(adminRole.id, permissions);
    }

    // Find the user role
    const customerRole = roles.find((role) => role.id === RoleEnum.customer);
    if (customerRole) {
      // Regular users get a subset of permissions (only own items and read:any)
      const customerPermissions = permissions.filter(
        (permission) =>
          permission?.name?.includes(':own') || permission?.name === 'read:any', // All 'own' permissions // Plus read:any permission
      );
      rolePermissionsMap.set(customerRole.id, customerPermissions);
    }

    // Assign permissions to each role
    for (const [roleId, rolePermissions] of rolePermissionsMap.entries()) {
      const role = roles.find((r) => r.id === roleId);
      if (role) {
        role.permissions = rolePermissions;
        await this.roleRepository.save(role);
        console.log(
          `Assigned ${rolePermissions.length} permissions to role ${role.name}`,
        );
      }
    }
  }
}
