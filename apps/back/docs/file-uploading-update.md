# File Upload System Documentation

This document describes the file upload system in Foundation NestJS, including the recent updates for private/public files and file management operations.

## Overview

The file upload system allows for:

- Uploading files with public or private access control
- Updating existing files
- Deleting files
- Managing file metadata in the database

## File Storage Structure

Files are stored in two main directories:

- `/files/public/` - For publicly accessible files that don't require authentication
- `/files/private/` - For files that require authentication to access

## API Endpoints

### Upload a File

```http
POST /api/v1/files/upload
```

**Request:**

- Content-Type: `multipart/form-data`
- Authentication: Bearer token required
- Body:
  - `file`: The file to upload
  - `isPublic`: (optional, boolean) Whether the file should be publicly accessible (default: `true`)

**Response:**

```json
{
  "file": {
    "id": "uuid-string",
    "path": "https://example.com/api/v1/files/public/filename.jpg",
    "isPublic": true
  }
}
```

### Update a File

```http
PUT /api/v1/files/:id
```

**Request:**

- Content-Type: `multipart/form-data`
- Authentication: Bearer token required
- Path Parameters:
  - `id`: The ID of the file to update
- Body:
  - `file`: The new file to replace the existing one
  - `isPublic`: (optional, boolean) Whether to change the file's access level

**Response:**

```json
{
  "file": {
    "id": "uuid-string",
    "path": "https://example.com/api/v1/files/public/updated-filename.jpg",
    "isPublic": true
  }
}
```

### Delete a File

```http
DELETE /api/v1/files/:id
```

**Request:**

- Authentication: Bearer token required
- Path Parameters:
  - `id`: The ID of the file to delete

**Response:**

- HTTP Status: 204 No Content

### Access Files

Public files:

```http
GET /api/v1/files/public/filename.jpg
```

Private files (requires authentication):

```http
GET /api/v1/files/private/filename.jpg
```

## Working with Files in Code

### Uploading Files

```typescript
// In your service
import { FilesService } from 'src/files/files.service';

@Injectable()
export class YourService {
  constructor(private readonly filesService: FilesService) {}

  async uploadUserAvatar(userId: string, file: Express.Multer.File) {
    // For a public file
    const { file: publicFile } = await this.filesService.create(file, true);

    // For a private file
    const { file: privateFile } = await this.filesService.create(file, false);

    // Save the file reference to your entity
    await this.userRepository.update(userId, { avatarId: publicFile.id });

    return publicFile;
  }
}
```

### Updating Files

```typescript
async updateUserAvatar(userId: string, file: Express.Multer.File) {
  // Get existing user with avatar
  const user = await this.userRepository.findById(userId);

  if (user.avatarId) {
    // Update the existing file
    const { file: updatedFile } = await this.filesService.update(
      user.avatarId,
      file
    );
    return updatedFile;
  } else {
    // Create a new file if no avatar exists
    const { file: newFile } = await this.filesService.create(file);
    await this.userRepository.update(userId, { avatarId: newFile.id });
    return newFile;
  }
}
```

### Deleting Files

```typescript
async deleteUserAvatar(userId: string) {
  // Get existing user with avatar
  const user = await this.userRepository.findById(userId);

  if (user.avatarId) {
    // Delete the file
    await this.filesService.delete(user.avatarId);

    // Update user to remove the reference
    await this.userRepository.update(userId, { avatarId: null });
    return true;
  }

  return false;
}
```

## Best Practices

1. **Use appropriate access control**: Make files private when they contain sensitive information.

2. **Clean up files**: Delete files when they are no longer needed to avoid storage bloat.

3. **Update references**: When updating or deleting files, make sure to update any database records that reference them.

4. **Handle errors**: Implement proper error handling for file operations, especially when deleting physical files.

5. **Validation**: Validate file types, sizes, and content before upload to prevent security issues.

6. **Consider using transactions**: When database operations are coupled with file operations, consider using transactions to ensure consistency.

## Implementation Notes

- Files are stored on the local filesystem by default, but the system is designed to support other storage providers like S3.
- File paths in the database store the relative path, while full URLs are generated when serving the file data.
- When updating a file, the old file is automatically deleted from the filesystem.
- For security, private files can only be accessed by authenticated users.
