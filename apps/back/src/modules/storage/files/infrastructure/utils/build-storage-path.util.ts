import { FileUploadDto } from '@storage/files/dto/file-upload.dto';

/**
 * Builds the structured storage subfolder path based on available metadata.
 *
 * Rules:
 * - All metadata: userId/entityName/entityId/context
 * - entityName + entityId only: userId/entityName/entityId
 * - context only: userId/context
 * - No metadata: userId (just the filename at user root)
 */
export function buildStoragePath(
  userId: number | undefined,
  dto: Pick<FileUploadDto, 'entityName' | 'entityId' | 'context'>,
): string {
  const parts: string[] = [];

  if (userId) {
    parts.push(String(userId));
  }

  const { entityName, entityId, context } = dto;
  const hasEntity = entityName && entityId;

  if (hasEntity && context) {
    // All metadata: userId/entityName/entityId/context
    parts.push(entityName, entityId, context);
  } else if (hasEntity) {
    // Only entity: userId/entityName/entityId
    parts.push(entityName, entityId);
  } else if (context) {
    // Only context: userId/context
    parts.push(context);
  }
  // else: no metadata → just userId

  return parts.join('/');
}
