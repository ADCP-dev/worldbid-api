import {
  In,
  Like,
  MoreThan,
  LessThan,
  MoreThanOrEqual,
  LessThanOrEqual,
  Between,
  Not,
} from 'typeorm';

/**
 * Parses filter parameters from query object following JSON API specification
 * Example: ?filter[name]=John&filter[status]=active
 */
export function parseFilters(query: Record<string, any>): Record<string, any> {
  const filters: Record<string, any> = {};

  if (!query.filter || typeof query.filter !== 'object') {
    return filters;
  }

  Object.keys(query.filter).forEach((key) => {
    filters[key] = query.filter[key];
  });

  return filters;
}

/**
 * Creates TypeORM where clause from filter object
 * Supports basic equality operations by default
 * Can be extended for more complex operations
 */
export function createWhereClause(
  filters: Record<string, any>,
): Record<string, any> {
  const where: Record<string, any> = {};

  Object.keys(filters).forEach((key) => {
    // Handle simple equality by default
    where[key] = filters[key];

    // You could extend this to handle operators like >=, <=, LIKE, etc.
    // For example, if filters[key] is 'gt:10', you could parse it as { [key]: MoreThan(10) }
  });

  return where;
}

/**
 * Builds TypeORM where clause from filter object
 * Handles advanced filtering with operators
 * @param filters - Object with filter conditions
 */
export function buildWhereClause(
  filters: Record<string, any>,
): Record<string, any> {
  const where: Record<string, any> = {};

  Object.entries(filters).forEach(([key, value]) => {
    // Handle different operators
    if (typeof value === 'string') {
      // Check for operator prefixes
      if (value.startsWith('like:')) {
        // LIKE operator - like:term becomes %term%
        where[key] = Like(`%${value.substring(5)}%`);
      } else if (value.startsWith('start:')) {
        // Starts with - start:term becomes term%
        where[key] = Like(`${value.substring(6)}%`);
      } else if (value.startsWith('end:')) {
        // Ends with - end:term becomes %term
        where[key] = Like(`%${value.substring(4)}`);
      } else if (value.startsWith('gt:')) {
        // Greater than
        where[key] = MoreThan(value.substring(3));
      } else if (value.startsWith('gte:')) {
        // Greater than or equal
        where[key] = MoreThanOrEqual(value.substring(4));
      } else if (value.startsWith('lt:')) {
        // Less than
        where[key] = LessThan(value.substring(3));
      } else if (value.startsWith('lte:')) {
        // Less than or equal
        where[key] = LessThanOrEqual(value.substring(4));
      } else if (value.startsWith('between:')) {
        // Between two values (comma separated)
        const [min, max] = value.substring(8).split(',');
        where[key] = Between(min, max);
      } else if (value === 'null') {
        // IS NULL
        where[key] = null;
      } else if (value === '!null') {
        // IS NOT NULL
        where[key] = Not(null);
      } else {
        // Default: exact match
        where[key] = value;
      }
    } else if (Array.isArray(value)) {
      // Handle IN operator for arrays
      where[key] = In(value);
    } else {
      // For other types (boolean, number, etc)
      where[key] = value;
    }
  });

  return where;
}
