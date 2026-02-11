import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

const COMMON_OWNER_FIELDS = ['ownerId', 'userId', 'createdBy'];

@Injectable()
export class OwnershipService {
  constructor(private readonly dataSource: DataSource) {}

  async isOwner(
    user: any,
    entityName: string,
    entityId: string,
  ): Promise<boolean> {
    /**
     * Step 1: Find the Entity Metadata
     *
     * This looks up TypeORM’s metadata for all registered entities.
     * It finds the entity whose name matches the provided entityName (case-insensitive).
     * This allows you to dynamically resolve the actual entity class from a string.
     */
    const entityMeta = this.dataSource.entityMetadatas.find(
      (meta) => meta.name.toLowerCase() === entityName.toLowerCase(),
    );

    /**
     * Step 2: Get the Repository for the Entity
     *
     * If no metadata is found, the function returns false (ownership check fails).
     * If metadata is found, it retrieves the entity class (entityMeta.target).
     * Then, it gets the repository for that entity using TypeORM’s getRepository
     */
    if (!entityMeta) return false;
    const entityClass = entityMeta.target;
    const repo = this.dataSource.getRepository(entityClass);

    /**
     * This searches the entity’s columns for a property that is likely to represent ownership, such as ownerId, userId, or createdBy.
     * If none is found, it defaults to 'ownerId'.
     * This makes the check generic for most common ownership patterns.
     */
    const ownerField =
      entityMeta.columns.find((col) =>
        COMMON_OWNER_FIELDS.includes(col.propertyName),
      )?.propertyName || 'ownerId';

    /**
     * Step 4: Query Only the Owner Field
     *
     * It creates a TypeORM query builder for the entity.
     * It selects only the owner field (e.g., ownerId).
     * It queries the entity by its ID.
     * If the entity is not found, it returns false (ownership check fails).
     */
    const result = await repo
      .createQueryBuilder(entityName)
      .select([`${entityName}.${ownerField}`])
      .where(`${entityName}.id = :id`, { id: entityId })
      .getOne();

    if (!result) return false;

    /**
     * Support both object and primitive ownerId (relation or FK)
     */
    const ownerValue = result[ownerField];
    const ownerId =
      typeof ownerValue === 'object' ? ownerValue?.id : ownerValue;

    /**
     * Compares the owner ID with the user ID
     */
    return String(ownerId) === String(user.id);
  }
}
