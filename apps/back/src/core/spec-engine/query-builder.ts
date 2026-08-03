/**
 * SpecQueryBuilder — translates a QuerySpec into a TypeORM QueryBuilder SQL.
 *
 * QuerySpec is the declarative query format used by dashboard panels:
 *   {
 *     resource: 'ext_tasks_task',
 *     aggregate: 'count',
 *     groupBy: 'status',
 *     timeRange: '30d',
 *     filter: 'priority == urgent && status != done',
 *     sort: { field: 'value', order: 'desc' },
 *     limit: 10,
 *     having: 'count > 5',
 *   }
 *
 * The builder produces parameterized SQL so that user-supplied filter
 * values are never interpolated into the query string — every literal
 * becomes a positional bind parameter ($1, $2, …), which is the primary
 * defense against SQL injection.
 *
 * Output shape:
 *   { sql: string; params: any[] }
 *
 * The `sql` string uses PostgreSQL syntax (DATE_TRUNC, NOW(), INTERVAL)
 * and positional parameters ($1, $2, …) compatible with TypeORM's
 * postgres driver.
 */

import { Repository } from 'typeorm';
import type { QuerySpec } from './spec.types';

export interface BuiltQuery {
  sql: string;
  params: any[];
}

// ─── Token types for the filter expression parser ──────────────────────────

type TokenType =
  | 'IDENT'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN'
  | 'AND'
  | 'OR'
  | 'STRING'
  | 'NUMBER'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
}

// AST node for a single comparison: field OP value
interface ComparisonNode {
  kind: 'comparison';
  field: string;
  operator: '==' | '!=';
  value: string | number;
}

// AST node for a boolean combination
interface LogicalNode {
  kind: 'logical';
  operator: '&&' | '||';
  left: FilterNode;
  right: FilterNode;
}

type FilterNode = ComparisonNode | LogicalNode;

// ─── Allowed identifier pattern ────────────────────────────────────────────
// Only ASCII letters, digits, and underscore are permitted in field/column
// names. This prevents injecting SQL through a crafted field name.
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Time range → PostgreSQL INTERVAL literal. Only whitelisted keys are
// accepted; arbitrary strings are never interpolated.
const TIME_RANGE_INTERVALS: Record<string, string> = {
  '7d': "INTERVAL '7 days'",
  '30d': "INTERVAL '30 days'",
  '90d': "INTERVAL '90 days'",
  '1y': "INTERVAL '1 year'",
};

// groupByInterval → DATE_TRUNC unit. Whitelisted only.
const DATE_TRUNC_UNITS: Record<string, string> = {
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
};

/**
 * SpecQueryBuilder — pure, stateless utility. Use the static `build`
 * method to turn a QuerySpec into runnable SQL + bind params.
 */
export class SpecQueryBuilder {
  /**
   * Build a parameterized SQL query from a QuerySpec.
   *
   * @param query    The declarative query spec.
   * @param _repository  TypeORM repository (reserved for future use — e.g.
   *                     emitting via repository.query or driver-specific
   *                     escaping). The SQL is driver-agnostic PostgreSQL.
   * @returns { sql, params } ready to pass to `repository.query(sql, params)`.
   */
  static build(query: QuerySpec, _repository: Repository<any>): BuiltQuery {
    if (!query || !query.resource) {
      throw new Error('SpecQueryBuilder: query.resource is required');
    }

    const table = this.validateIdent(query.resource, 'resource (table)');
    const params: any[] = [];
    const parts: string[] = [];

    // ── SELECT clause ────────────────────────────────────────────────────
    const aggregateExpr = this.buildAggregateExpr(query, params);
    let selectClause: string;

    if (query.groupBy) {
      const groupByExpr = this.buildGroupByExpr(query);
      selectClause = `SELECT ${groupByExpr} AS "label", ${aggregateExpr} AS "value"`;
    } else {
      selectClause = `SELECT ${aggregateExpr} AS "value"`;
    }
    parts.push(selectClause);

    // ── FROM clause ──────────────────────────────────────────────────────
    parts.push(`FROM "${table}"`);

    // ── WHERE clause ─────────────────────────────────────────────────────
    const whereParts: string[] = [];

    // user-supplied filter expression
    if (query.filter) {
      const filterSql = this.buildFilter(query.filter, params);
      if (filterSql) whereParts.push(filterSql);
    }

    // time range
    if (query.timeRange) {
      const interval = TIME_RANGE_INTERVALS[query.timeRange];
      if (interval) {
        const timeField = this.validateIdent(
          query.groupBy || 'createdAt',
          'timeRange field',
        );
        whereParts.push(`"${timeField}" > NOW() - ${interval}`);
      }
    }

    if (whereParts.length > 0) {
      parts.push(`WHERE ${whereParts.join(' AND ')}`);
    }

    // ── GROUP BY clause ──────────────────────────────────────────────────
    if (query.groupBy) {
      const groupByExpr = this.buildGroupByExpr(query);
      parts.push(`GROUP BY ${groupByExpr}`);
    }

    // ── HAVING clause ────────────────────────────────────────────────────
    if (query.having) {
      const havingSql = this.buildHaving(query.having, params);
      if (havingSql) parts.push(`HAVING ${havingSql}`);
    }

    // ── ORDER BY clause ──────────────────────────────────────────────────
    if (query.sort) {
      const sortField = this.validateIdent(query.sort.field, 'sort.field');
      const order =
        (query.sort.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      // When sorting by the aggregate, use the alias; otherwise quote the column.
      if (sortField === 'value' || sortField === 'label') {
        parts.push(`ORDER BY "${sortField}" ${order}`);
      } else {
        parts.push(`ORDER BY "${sortField}" ${order}`);
      }
    }

    // ── LIMIT clause ─────────────────────────────────────────────────────
    if (query.limit !== undefined && query.limit !== null) {
      const limitNum = Math.max(0, Math.floor(Number(query.limit)));
      if (!Number.isFinite(limitNum)) {
        throw new Error(
          'SpecQueryBuilder: query.limit must be a finite number',
        );
      }
      // LIMIT takes a literal integer; validated & bounded, no injection risk.
      parts.push(`LIMIT ${limitNum}`);
    }

    return { sql: parts.join('\n'), params };
  }

  // ─── Aggregate expression ──────────────────────────────────────────────────

  /**
   * Build the aggregate expression for the SELECT clause.
   * `count` uses COUNT(*); the others require `aggregateField`.
   */
  private static buildAggregateExpr(query: QuerySpec, _params: any[]): string {
    const agg = (query.aggregate || 'count').toLowerCase();

    switch (agg) {
      case 'count':
        return 'COUNT(*)';

      case 'sum':
      case 'avg':
      case 'min':
      case 'max': {
        if (!query.aggregateField) {
          throw new Error(
            `SpecQueryBuilder: aggregate "${agg}" requires aggregateField`,
          );
        }
        const field = this.validateIdent(
          query.aggregateField,
          'aggregateField',
        );
        const fn = agg.toUpperCase();
        return `${fn}("${field}")`;
      }

      default:
        throw new Error(`SpecQueryBuilder: unsupported aggregate "${agg}"`);
    }
  }

  // ─── GROUP BY expression ───────────────────────────────────────────────────

  /**
   * Build the GROUP BY expression. For date fields with a `groupByInterval`,
   * wraps the column in DATE_TRUNC so rows are bucketed by time period.
   */
  private static buildGroupByExpr(query: QuerySpec): string {
    if (!query.groupBy) {
      throw new Error(
        'SpecQueryBuilder: groupBy is required to build a group-by expression',
      );
    }
    const field = this.validateIdent(query.groupBy, 'groupBy field');

    if (query.groupByInterval) {
      const unit = DATE_TRUNC_UNITS[query.groupByInterval];
      if (!unit) {
        throw new Error(
          `SpecQueryBuilder: unsupported groupByInterval "${query.groupByInterval}"`,
        );
      }
      return `DATE_TRUNC('${unit}', "${field}")`;
    }

    return `"${field}"`;
  }

  // ─── Filter expression → WHERE SQL ─────────────────────────────────────────

  /**
   * Parse a filter expression like:
   *   priority == urgent && status != done
   *   (priority == urgent || priority == high) && status != done
   *
   * Supported operators: ==, !=
   * Supported logical: && (AND), || (OR), with parentheses for grouping.
   *
   * Field names are validated against IDENT_RE; values become bind params.
   */
  private static buildFilter(expression: string, params: any[]): string {
    const tokens = this.tokenizeFilter(expression);
    const parser = new FilterParser(tokens);
    const ast = parser.parse();
    if (!parser.atEnd()) {
      throw new Error(
        'SpecQueryBuilder: unexpected trailing tokens in filter expression',
      );
    }
    return this.compileFilterNode(ast, params);
  }

  /**
   * Compile a filter AST node into a parameterized SQL fragment.
   */
  private static compileFilterNode(node: FilterNode, params: any[]): string {
    if (node.kind === 'comparison') {
      const field = this.validateIdent(node.field, 'filter field');
      const op = node.operator === '==' ? '=' : '<>';
      const paramIndex = params.push(node.value);
      return `"${field}" ${op} $${paramIndex}`;
    }

    // logical node
    const left = this.compileFilterNode(node.left, params);
    const right = this.compileFilterNode(node.right, params);
    const op = node.operator === '&&' ? 'AND' : 'OR';
    return `(${left} ${op} ${right})`;
  }

  // ─── HAVING expression → SQL ───────────────────────────────────────────────

  /**
   * Parse a HAVING expression like `count > 5` or `sum >= 100`.
   *
   * Supported comparators: >, >=, <, <=, ==, !=
   * The left side must be a bare identifier (the aggregate alias, e.g.
   * `count`, `sum`, `value`). The right side is a literal that becomes a
   * bind parameter.
   */
  private static buildHaving(expression: string, params: any[]): string {
    const raw = String(expression ?? '').trim();
    if (!raw) return '';

    // Match:  <ident> <comparator> <literal>
    const match = raw.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|==|!=|>|<)\s*(.+)$/,
    );
    if (!match) {
      throw new Error(
        `SpecQueryBuilder: invalid HAVING expression "${expression}"`,
      );
    }

    const [, ident, comparatorRaw, literalRaw] = match;
    const alias = this.validateIdent(ident, 'having alias');

    // Map spec operators to SQL operators.
    const comparatorMap: Record<string, string> = {
      '>': '>',
      '>=': '>=',
      '<': '<',
      '<=': '<=',
      '==': '=',
      '!=': '<>',
    };
    const comparator = comparatorMap[comparatorRaw];
    if (!comparator) {
      throw new Error(
        `SpecQueryBuilder: unsupported HAVING comparator "${comparatorRaw}"`,
      );
    }

    const literal = this.parseLiteral(literalRaw.trim());
    const paramIndex = params.push(literal.value);

    // The alias is validated as an identifier; reference it unquoted so it
    // resolves the SELECT alias (PostgreSQL lowercases unquoted identifiers).
    return `${alias} ${comparator} $${paramIndex}`;
  }

  // ─── Filter tokenizer ──────────────────────────────────────────────────────

  /**
   * Tokenize a filter expression into a stream of tokens.
   */
  private static tokenizeFilter(input: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const src = String(input ?? '');

    while (i < src.length) {
      const ch = src[i];

      // Skip whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Parentheses
      if (ch === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
        continue;
      }

      // Operators: == and != (two-char)
      if (ch === '=' && src[i + 1] === '=') {
        tokens.push({ type: 'OP', value: '==' });
        i += 2;
        continue;
      }
      if (ch === '!' && src[i + 1] === '=') {
        tokens.push({ type: 'OP', value: '!=' });
        i += 2;
        continue;
      }

      // Logical operators: && and ||
      if (ch === '&' && src[i + 1] === '&') {
        tokens.push({ type: 'AND', value: '&&' });
        i += 2;
        continue;
      }
      if (ch === '|' && src[i + 1] === '|') {
        tokens.push({ type: 'OR', value: '||' });
        i += 2;
        continue;
      }

      // Single = or ! is invalid
      if (ch === '=' || ch === '!') {
        throw new Error(
          `SpecQueryBuilder: unexpected "${ch}" in filter at position ${i}`,
        );
      }

      // String literal: '...' or "..."
      if (ch === "'" || ch === '"') {
        const quote = ch;
        i++;
        let value = '';
        while (i < src.length && src[i] !== quote) {
          // Allow escaped quote by doubling
          if (src[i] === quote && src[i + 1] === quote) {
            value += quote;
            i += 2;
            continue;
          }
          value += src[i];
          i++;
        }
        if (i >= src.length) {
          throw new Error(
            'SpecQueryBuilder: unterminated string literal in filter',
          );
        }
        i++; // skip closing quote
        tokens.push({ type: 'STRING', value });
        continue;
      }

      // Number literal (integer or decimal, optional leading -)
      if (ch === '-' || /[0-9]/.test(ch)) {
        let num = '';
        if (ch === '-') {
          num += '-';
          i++;
        }
        while (i < src.length && /[0-9.]/.test(src[i])) {
          num += src[i];
          i++;
        }
        if (num === '-' || num === '') {
          throw new Error(
            `SpecQueryBuilder: invalid number in filter at position ${i}`,
          );
        }
        tokens.push({ type: 'NUMBER', value: num });
        continue;
      }

      // Identifier (field name)
      if (/[A-Za-z_]/.test(ch)) {
        let ident = '';
        while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) {
          ident += src[i];
          i++;
        }
        tokens.push({ type: 'IDENT', value: ident });
        continue;
      }

      throw new Error(
        `SpecQueryBuilder: unexpected character "${ch}" in filter at position ${i}`,
      );
    }

    tokens.push({ type: 'EOF', value: '' });
    return tokens;
  }

  // ─── Literal parsing (for HAVING) ──────────────────────────────────────────

  /**
   * Parse a literal value (string or number) from a raw token string.
   */
  private static parseLiteral(raw: string): { value: string | number } {
    const trimmed = raw.trim();

    // Quoted string
    if (
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith('"') && trimmed.endsWith('"'))
    ) {
      return { value: trimmed.slice(1, -1) };
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (!Number.isFinite(num)) {
        throw new Error(`SpecQueryBuilder: invalid numeric literal "${raw}"`);
      }
      return { value: num };
    }

    // Bareword — treat as string (e.g. `count > 5` has a numeric literal,
    // but `status == open` would also reach here as `open`). For HAVING we
    // only expect numeric comparisons, but we accept barewords defensively.
    return { value: trimmed };
  }

  // ─── Identifier validation ─────────────────────────────────────────────────

  /**
   * Validate that an identifier only contains safe characters. This is the
   * guard that prevents SQL injection via column/table/field names — those
   * are the only parts of the query that cannot be bind-parameterized.
   *
   * Returns the validated identifier unchanged.
   */
  private static validateIdent(ident: string, label: string): string {
    const value = String(ident ?? '');
    if (!IDENT_RE.test(value)) {
      throw new Error(
        `SpecQueryBuilder: invalid identifier "${value}" for ${label}; ` +
          'only letters, digits, and underscore are allowed, and it must ' +
          'not start with a digit',
      );
    }
    return value;
  }
}

// ─── Recursive-descent filter parser ───────────────────────────────────────
//
// Grammar (lowest to highest precedence):
//   orExpr   := andExpr ( '||' andExpr )*
//   andExpr  := notExpr ( '&&' notExpr )*
//   primary  := '(' orExpr ')' | comparison
//   comparison := IDENT OP ( STRING | NUMBER | IDENT )
//
// Note: we treat bareword values (IDENT on the RHS) as strings so that
// `priority == urgent` works without requiring quotes.

class FilterParser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): FilterNode {
    return this.parseOr();
  }

  atEnd(): boolean {
    return this.peek().type === 'EOF';
  }

  // ── orExpr ─────────────────────────────────────────────────────────────
  private parseOr(): FilterNode {
    let left = this.parseAnd();
    while (this.peek().type === 'OR') {
      this.advance();
      const right = this.parseAnd();
      left = { kind: 'logical', operator: '||', left, right };
    }
    return left;
  }

  // ── andExpr ────────────────────────────────────────────────────────────
  private parseAnd(): FilterNode {
    let left = this.parsePrimary();
    while (this.peek().type === 'AND') {
      this.advance();
      const right = this.parsePrimary();
      left = { kind: 'logical', operator: '&&', left, right };
    }
    return left;
  }

  // ── primary ────────────────────────────────────────────────────────────
  private parsePrimary(): FilterNode {
    const tok = this.peek();

    if (tok.type === 'LPAREN') {
      this.advance();
      const node = this.parseOr();
      const close = this.peek();
      if (close.type !== 'RPAREN') {
        throw new Error('SpecQueryBuilder: missing ")" in filter expression');
      }
      this.advance();
      return node;
    }

    return this.parseComparison();
  }

  // ── comparison ─────────────────────────────────────────────────────────
  private parseComparison(): ComparisonNode {
    const fieldTok = this.peek();
    if (fieldTok.type !== 'IDENT') {
      throw new Error(
        `SpecQueryBuilder: expected field name in filter, got "${fieldTok.value || fieldTok.type}"`,
      );
    }
    this.advance();

    const opTok = this.peek();
    if (opTok.type !== 'OP') {
      throw new Error(
        `SpecQueryBuilder: expected comparison operator (== or !=) in filter, got "${opTok.value || opTok.type}"`,
      );
    }
    this.advance();

    const valTok = this.peek();
    let value: string | number;

    switch (valTok.type) {
      case 'STRING':
        value = valTok.value;
        this.advance();
        break;
      case 'NUMBER':
        value = Number(valTok.value);
        if (!Number.isFinite(value)) {
          throw new Error(
            `SpecQueryBuilder: invalid number "${valTok.value}" in filter`,
          );
        }
        this.advance();
        break;
      case 'IDENT':
        // Bareword treated as a string literal (e.g. `status == open`).
        value = valTok.value;
        this.advance();
        break;
      default:
        throw new Error(
          `SpecQueryBuilder: expected value in filter, got "${valTok.value || valTok.type}"`,
        );
    }

    return {
      kind: 'comparison',
      field: fieldTok.value,
      operator: opTok.value as '==' | '!=',
      value,
    };
  }

  // ── token helpers ──────────────────────────────────────────────────────
  private peek(): Token {
    return this.tokens[this.pos] ?? { type: 'EOF', value: '' };
  }

  private advance(): void {
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
  }
}
