# API Key Authentication

This module provides API key authentication alongside the existing JWT authentication system. Users can authenticate using either JWT tokens or API keys.

## Features

- **Dual Authentication**: Support for both JWT and API key authentication
- **Automatic API Key Generation**: Creates API keys for users who don't have one
- **API Key Management**: Generate, regenerate, and revoke API keys
- **Secure Key Generation**: Uses cryptographically secure random generation
- **Database Integration**: Stores API keys with proper relationships to users

## API Endpoints

### Get Current User's API Key
```http
GET /api/v1/api-keys
Authorization: Bearer <jwt_token>
```

### Generate New API Key
```http
POST /api/v1/api-keys/generate
Authorization: Bearer <jwt_token>
```

### Regenerate API Key
```http
POST /api/v1/api-keys/regenerate
Authorization: Bearer <jwt_token>
```

### Revoke API Key
```http
DELETE /api/v1/api-keys
Authorization: Bearer <jwt_token>
```

## Usage Examples

### Using JWT Authentication (existing)
```http
GET /api/v1/templates
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Using API Key Authentication (new)
```http
GET /api/v1/templates
X-API-Key: ak_abc123def456ghi789jkl012mno345pqr678
```

### Using the Combined Guard in Controllers

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';

@Controller('templates')
export class TemplatesController {
  @Get()
  @UseGuards(JwtOrApiKeyGuard) // Accepts either JWT or API key
  async findAll() {
    // This endpoint can be accessed with either:
    // - Authorization: Bearer <jwt_token>
    // - X-API-Key: <api_key>
  }
}
```

## API Key Format

API keys follow the format: `ak_<random_string><timestamp>`

Example: `ak_abc123def456ghi789jkl012mno345pqr678`

## Security Notes

- API keys are permanent until regenerated or revoked
- Each user can have only one active API key at a time
- Generating a new API key automatically revokes the previous one
- API keys are stored securely in the database with proper indexing
- The system uses cryptographically secure random generation

## Database Schema

The `api_key` table includes:
- `id`: Primary key
- `key`: Unique API key string (indexed)
- `userId`: Foreign key to user table
- `createdAt`: Creation timestamp
- `updatedAt`: Last update timestamp
- `deletedAt`: Soft deletion timestamp

## Migration

Run the migration to create the API key table:

```bash
npm run migration:run
```

The migration file is located at: `src/database/migrations/1753360000000-CreateApiKey.ts`


## Usage

✅ How to Use API Key Authentication for Routes

**1. For API Key Only Authentication:**
Use the 
```ApiKeyGuard```
 that you've already implemented:

```typescript
import { UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ApiSecurity } from '@nestjs/swagger';

@Controller('templates')
export class TemplatesController {
  @Get()
  @ApiSecurity('api-key')  // Swagger documentation
  @UseGuards(ApiKeyGuard)  // Only API key authentication
  async findAllWithPagination() {
    // This endpoint requires X-API-Key header
  }
}
```

**2. For Either JWT OR API Key Authentication:**
Use the 
```JwtOrApiKeyGuard```
 for flexible authentication:

```typescript
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';

@Controller('templates')
export class TemplatesController {
  @Get('flexible')
  @ApiBearerAuth()        // For JWT
  @ApiSecurity('api-key') // For API key
  @UseGuards(JwtOrApiKeyGuard)  // Accepts either authentication method
  async flexibleEndpoint() {
    // Can be accessed with either:
    // Authorization: Bearer <jwt_token>
    // OR
    // X-API-Key: <api_key>
  }
}