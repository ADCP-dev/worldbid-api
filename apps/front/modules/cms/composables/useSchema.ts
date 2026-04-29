/**
 * useSchema Composable
 * Manages JSON-LD schema collection for structured data markup
 * Used to inject schema.org structured data into pages for better SEO
 *
 * Usage:
 * ```ts
 * const { addSchema, removeSchema, getSchemasJson } = useSchema()
 *
 * // Add an Article schema for blog post
 * addSchema('Article', { slug: 'my-post', metaTitle: 'My Post', ... })
 *
 * // Add a BreadcrumbList for navigation
 * addSchema('BreadcrumbList', { pathSegments: [...] })
 *
 * // Get all schemas as JSON string for <script type="application/ld+json">
 * const jsonLd = getSchemasJson()
 * ```
 */

import type {
  SchemaType,
  JsonLdSchema,
  ArticleSchemaInput,
  OrganizationSchemaInput,
  BreadcrumbSchemaInput,
  WebPageSchemaInput,
  WebSiteSchemaInput,
  ProductSchemaInput,
  SchemaInput,
} from '../types/json-ld';
import {
  createArticleSchema,
  createOrganizationSchema,
  createBreadcrumbSchema,
  createWebPageSchema,
  createWebSiteSchema,
  createProductSchema,
} from '../utils/json-ld';

// Type for schema factory functions
type SchemaFactory<T extends SchemaInput = SchemaInput> = (
  input: T,
) => JsonLdSchema;

// Factory map for type-safe schema generation
const schemaFactories: Record<SchemaType, SchemaFactory> = {
  Article: createArticleSchema as SchemaFactory,
  Organization: createOrganizationSchema as SchemaFactory,
  BreadcrumbList: createBreadcrumbSchema as SchemaFactory,
  WebPage: createWebPageSchema as SchemaFactory,
  WebSite: createWebSiteSchema as SchemaFactory,
  Product: createProductSchema as SchemaFactory,
} as const;

export function useSchema() {
  // Internal state to hold all schemas
  const schemas = ref<JsonLdSchema[]>([]);

  /**
   * Add a schema to the collection
   * @param type - The schema type ('Article', 'BreadcrumbList', etc.)
   * @param input - The schema input data matching the schema type
   */
  function addSchema<T extends SchemaInput>(
    type: SchemaType,
    input: T,
  ): boolean {
    const factory = schemaFactories[type];
    if (!factory) {
      console.warn(`[useSchema] Unknown schema type: ${type}`);
      return false;
    }

    try {
      const schema = factory(input as any);
      schemas.value.push(schema);
      return true;
    } catch (error) {
      console.error(`[useSchema] Failed to create schema of type ${type}:`, error);
      return false;
    }
  }

  /**
   * Remove all schemas of a specific type
   * @param type - The schema type to remove
   */
  function removeSchema(type: SchemaType): void {
    schemas.value = schemas.value.filter((s) => s['@type'] !== type);
  }

  /**
   * Clear all schemas from the collection
   */
  function clearSchemas(): void {
    schemas.value = [];
  }

  /**
   * Get all schemas as a JSON string
   * Use this in a <script type="application/ld+json"> tag
   * @returns JSON string representation of all schemas
   */
  function getSchemasJson(): string {
    return JSON.stringify(schemas.value);
  }

  /**
   * Get raw schemas array
   * Useful for debugging or direct template access
   */
  function getSchemas(): JsonLdSchema[] {
    return schemas.value;
  }

  return {
    // Reactive schemas array
    schemas: readonly(schemas),

    // Methods
    addSchema,
    removeSchema,
    clearSchemas,
    getSchemasJson,
    getSchemas,
  };
}