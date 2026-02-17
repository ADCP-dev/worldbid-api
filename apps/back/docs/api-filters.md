# API Filtering System

This document explains how to use the filtering system in API requests for listing and paginating resources.

## Overview

The Foundation API supports advanced filtering on GET requests, allowing you to narrow down results based on various field conditions. Filters follow the format `filter[fieldName]=value` and can be combined for more complex queries.

## Basic Usage

To filter resources by a specific field, use the `filter` parameter with the field name in square brackets:

```
GET /api/v1/countries?filter[name]=Spain
```

This will return countries where the name exactly matches "Spain".

## Filter Operators

The system supports various operators to provide flexible filtering capabilities:

| Operator              | Syntax                                      | Description                         | Example                                        |
| --------------------- | ------------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| Exact match           | `filter[field]=value`                       | Exact value match                   | `filter[name]=Spain`                           |
| Like                  | `filter[field]=like:value`                  | Contains value (SQL LIKE %value%)   | `filter[name]=like:Spa`                        |
| Starts with           | `filter[field]=start:value`                 | Starts with value (SQL LIKE value%) | `filter[name]=start:Esp`                       |
| Ends with             | `filter[field]=end:value`                   | Ends with value (SQL LIKE %value)   | `filter[name]=end:ain`                         |
| Greater than          | `filter[field]=gt:value`                    | Greater than value                  | `filter[population]=gt:1000000`                |
| Greater than or equal | `filter[field]=gte:value`                   | Greater than or equal to value      | `filter[population]=gte:1000000`               |
| Less than             | `filter[field]=lt:value`                    | Less than value                     | `filter[population]=lt:1000000`                |
| Less than or equal    | `filter[field]=lte:value`                   | Less than or equal to value         | `filter[population]=lte:1000000`               |
| Between               | `filter[field]=between:min,max`             | Between two values (inclusive)      | `filter[population]=between:1000000,5000000`   |
| Is null               | `filter[field]=null`                        | Field is null                       | `filter[region]=null`                          |
| Is not null           | `filter[field]=!null`                       | Field is not null                   | `filter[region]=!null`                         |
| In array              | `filter[field]=value1&filter[field]=value2` | Field matches any value in array    | `filter[status]=active&filter[status]=pending` |

## Combining Filters

You can apply multiple filters in a single request to narrow down results with AND logic:

```
GET /api/v1/countries?filter[name]=start:Esp&filter[population]=gt:40000000
```

This will return countries where the name starts with "Esp" AND the population is greater than 40,000,000.

## Examples

### Basic Filtering

Find countries with exact name match:

```
GET /api/v1/countries?filter[name]=Spain
```

### Partial Text Matching

Find countries that have "land" in their name:

```
GET /api/v1/countries?filter[name]=like:land
```

Find countries that start with "United":

```
GET /api/v1/countries?filter[name]=start:United
```

Find countries that end with "ia":

```
GET /api/v1/countries?filter[name]=end:ia
```

### Numeric Filtering

Find countries with population greater than 100 million:

```
GET /api/v1/countries?filter[population]=gt:100000000
```

Find countries with area between 100,000 and 500,000 square kilometers:

```
GET /api/v1/countries?filter[area]=between:100000,500000
```

### Null Values

Find countries with no capital city defined:

```
GET /api/v1/countries?filter[capital]=null
```

Find countries that have a capital city defined:

```
GET /api/v1/countries?filter[capital]=!null
```

### Complex Filtering

Find European countries with population less than 10 million:

```
GET /api/v1/countries?filter[continent]=Europe&filter[population]=lt:10000000
```

## Implementation Details

The filtering system is implemented in `src/utils/parse-filter.ts`. The main functions are:

- `parseFilters`: Extracts filter parameters from the query object
- `buildWhereClause`: Converts filter parameters into TypeORM query conditions

## Using Filters with Pagination

Filters can be combined with pagination parameters:

```
GET /api/v1/countries?filter[continent]=Europe&page=1&limit=10
```

This will return the first page of European countries with 10 items per page.

## Best Practices

1. Use the appropriate operator for the data type you're filtering
2. Combine filters to create more specific queries
3. Consider performance when filtering on non-indexed fields
4. URL-encode filter values when they contain special characters
