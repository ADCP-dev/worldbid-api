import type {
  SchemaType,
  JsonLdSchema,
  ArticleSchemaInput,
  BlogPostingSchemaInput,
  OrganizationSchemaInput,
  BreadcrumbSchemaInput,
  WebPageSchemaInput,
  WebSiteSchemaInput,
  ProductSchemaInput,
} from './types';
import {
  createArticleSchema,
  createBlogPostingSchema,
  createOrganizationSchema,
  createBreadcrumbSchema,
  createWebPageSchema,
  createWebSiteSchema,
  createProductSchema,
} from './json-ld.factories';

// Factory function type
type SchemaFactory<T> = (input: T) => JsonLdSchema;

// Registry entry
interface SchemaFactoryEntry {
  factory: SchemaFactory<unknown>;
  inputType: string;
}

// Schema registry map
const schemaRegistryMap: Record<SchemaType, SchemaFactoryEntry> = {
  Article: {
    factory: createArticleSchema as SchemaFactory<unknown>,
    inputType: 'ArticleSchemaInput',
  },
  BlogPosting: {
    factory: createBlogPostingSchema as SchemaFactory<unknown>,
    inputType: 'BlogPostingSchemaInput',
  },
  Organization: {
    factory: createOrganizationSchema as SchemaFactory<unknown>,
    inputType: 'OrganizationSchemaInput',
  },
  BreadcrumbList: {
    factory: createBreadcrumbSchema as SchemaFactory<unknown>,
    inputType: 'BreadcrumbSchemaInput',
  },
  WebPage: {
    factory: createWebPageSchema as SchemaFactory<unknown>,
    inputType: 'WebPageSchemaInput',
  },
  WebSite: {
    factory: createWebSiteSchema as SchemaFactory<unknown>,
    inputType: 'WebSiteSchemaInput',
  },
  Product: {
    factory: createProductSchema as SchemaFactory<unknown>,
    inputType: 'ProductSchemaInput',
  },
};

// JsonLdSchemaRegistry singleton
export class JsonLdSchemaRegistry {
  private static instance: JsonLdSchemaRegistry;
  private factories: Map<SchemaType, SchemaFactoryEntry>;

  private constructor() {
    this.factories = new Map(
      Object.entries(schemaRegistryMap) as [SchemaType, SchemaFactoryEntry][],
    );
  }

  static getInstance(): JsonLdSchemaRegistry {
    if (!JsonLdSchemaRegistry.instance) {
      JsonLdSchemaRegistry.instance = new JsonLdSchemaRegistry();
    }
    return JsonLdSchemaRegistry.instance;
  }

  // Get factory for schema type
  getFactory(type: SchemaType): SchemaFactoryEntry | undefined {
    return this.factories.get(type);
  }

  // Check if type is registered
  has(type: SchemaType): boolean {
    return this.factories.has(type);
  }

  // Get all registered types
  getRegisteredTypes(): SchemaType[] {
    return Array.from(this.factories.keys()) as SchemaType[];
  }

  // Register new schema type (extensibility)
  register<T>(type: SchemaType, factory: SchemaFactory<T>): void {
    this.factories.set(type, {
      factory: factory as SchemaFactory<unknown>,
      inputType: 'unknown',
    });
  }

  // Generate schema by type
  generate(type: SchemaType, input: unknown): JsonLdSchema | null {
    const entry = this.factories.get(type);
    if (!entry) {
      return null;
    }
    return entry.factory(input);
  }
}

// Export singleton instance
export const schemaRegistry = JsonLdSchemaRegistry.getInstance();

// Convenience function
export function generateSchema<T extends Record<string, unknown>>(
  type: SchemaType,
  input: T,
): JsonLdSchema | null {
  return schemaRegistry.generate(type, input);
}

// Re-export types for convenience
export type {
  ArticleSchemaInput,
  BlogPostingSchemaInput,
  OrganizationSchemaInput,
  BreadcrumbSchemaInput,
  WebPageSchemaInput,
  WebSiteSchemaInput,
  ProductSchemaInput,
} from './types';
