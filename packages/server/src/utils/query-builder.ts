/**
 * Query Builder - Dynamic SQL query construction
 * Supports filtering, sorting, pagination, field selection, and joins
 */

export interface QueryOptions {
  page?: number;
  limit?: number;
  filters?: Record<string, any>;
  sort?: string | string[];
  order?: 'asc' | 'desc';
  select?: string[];
  joins?: JoinConfig[];
}

export interface JoinConfig {
  table: string;
  on: string;
  type?: 'LEFT' | 'INNER' | 'RIGHT';
  alias?: string;
}

export interface QueryResult {
  sql: string;
  params: any[];
  countSql?: string;
  countParams?: any[];
}

/**
 * Build dynamic WHERE clause from filters
 */
export function buildWhereClause(
  filters: Record<string, any>,
  tableAlias?: string
): { clause: string; params: any[] } {
  const clauses: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    const column = tableAlias ? `${tableAlias}.${key}` : key;

    // Handle different filter value types
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Advanced filters: { field: { op: value } }
      for (const [operator, filterValue] of Object.entries(value)) {
        const { clause: opClause, params: opParams } = buildOperatorClause(
          column,
          operator,
          filterValue
        );
        clauses.push(opClause);
        params.push(...opParams);
      }
    } else if (Array.isArray(value)) {
      // IN clause
      clauses.push(`${column} IN (${value.map(() => '?').join(', ')})`);
      params.push(...value);
    } else {
      // Simple equality
      clauses.push(`${column} = ?`);
      params.push(value);
    }
  }

  return {
    clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

/**
 * Build operator-specific clause
 */
function buildOperatorClause(
  column: string,
  operator: string,
  value: any
): { clause: string; params: any[] } {
  switch (operator) {
    case 'eq':
      return { clause: `${column} = ?`, params: [value] };
    case 'ne':
      return { clause: `${column} != ?`, params: [value] };
    case 'gt':
      return { clause: `${column} > ?`, params: [value] };
    case 'gte':
      return { clause: `${column} >= ?`, params: [value] };
    case 'lt':
      return { clause: `${column} < ?`, params: [value] };
    case 'lte':
      return { clause: `${column} <= ?`, params: [value] };
    case 'like':
      return { clause: `${column} LIKE ?`, params: [`%${value}%`] };
    case 'startsWith':
      return { clause: `${column} LIKE ?`, params: [`${value}%`] };
    case 'endsWith':
      return { clause: `${column} LIKE ?`, params: [`%${value}`] };
    case 'in':
      const values = Array.isArray(value) ? value : [value];
      return {
        clause: `${column} IN (${values.map(() => '?').join(', ')})`,
        params: values,
      };
    case 'nin':
      const notValues = Array.isArray(value) ? value : [value];
      return {
        clause: `${column} NOT IN (${notValues.map(() => '?').join(', ')})`,
        params: notValues,
      };
    case 'between':
      return {
        clause: `${column} BETWEEN ? AND ?`,
        params: [value[0], value[1]],
      };
    default:
      return { clause: `${column} = ?`, params: [value] };
  }
}

/**
 * Build ORDER BY clause
 */
export function buildOrderBy(
  sort: string | string[],
  order: 'asc' | 'desc' = 'asc',
  tableAlias?: string
): string {
  if (!sort) return '';

  const sorts = Array.isArray(sort) ? sort : [sort];
  
  const orderClauses = sorts.map((field) => {
    // Support multi-field sort: "field:asc" or "field:desc"
    const parts = field.split(':');
    const fieldName = parts[0];
    const fieldOrder = parts[1] || order;
    const column = tableAlias ? `${tableAlias}.${fieldName}` : fieldName;
    
    return `${column} ${fieldOrder.toUpperCase()}`;
  });

  return `ORDER BY ${orderClauses.join(', ')}`;
}

/**
 * Build SELECT clause with field selection
 */
export function buildSelectClause(
  select: string[] | undefined,
  tableAlias?: string
): string {
  if (!select || select.length === 0) {
    return tableAlias ? `${tableAlias}.*` : '*';
  }

  return select
    .map((field) => (tableAlias ? `${tableAlias}.${field}` : field))
    .join(', ');
}

/**
 * Build JOIN clauses
 */
export function buildJoinClauses(joins: JoinConfig[] = []): {
  clauses: string;
  params: any[];
} {
  if (!joins || joins.length === 0) {
    return { clauses: '', params: [] };
  }

  const clauses: string[] = [];
  const params: any[] = [];

  for (const join of joins) {
    const type = join.type || 'LEFT';
    const alias = join.alias ? ` AS ${join.alias}` : '';
    clauses.push(`${type} JOIN ${join.table}${alias} ON ${join.on}`);
  }

  return { clauses: clauses.join(' '), params };
}

/**
 * Build pagination clause
 */
export function buildPagination(page: number = 1, limit: number = 20): {
  limit: number;
  offset: number;
} {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100); // Max 100 per page
  const offset = (safePage - 1) * safeLimit;

  return { limit: safeLimit, offset };
}

/**
 * Build complete query for JSON data extraction
 * Special handling for collection_data table with JSON field
 */
export function buildDataQuery(
  tableName: string,
  options: QueryOptions = {},
  tableAlias: string = 't'
): QueryResult {
  const {
    filters = {},
    sort,
    order = 'asc',
    select,
    joins = [],
    page = 1,
    limit = 20,
  } = options;

  const selectClause = buildSelectClause(select, tableAlias);
  const { clause: whereClause, params: whereParams } = buildWhereClause(
    filters,
    tableAlias
  );
  const orderByClause = buildOrderBy(sort, order, tableAlias);
  const { clauses: joinClauses, params: joinParams } = buildJoinClauses(joins);
  const { limit: pageLimit, offset } = buildPagination(page, limit);

  const sql = `
    SELECT ${selectClause}
    FROM ${tableName} ${tableAlias}
    ${joinClauses}
    ${whereClause}
    ${orderByClause}
    LIMIT ? OFFSET ?
  `.trim();

  const params = [...whereParams, ...joinParams, pageLimit, offset];

  // Build count query for pagination
  const countSql = `
    SELECT COUNT(*) as count
    FROM ${tableName} ${tableAlias}
    ${joinClauses}
    ${whereClause}
  `.trim();

  const countParams = [...whereParams, ...joinParams];

  return {
    sql,
    params,
    countSql,
    countParams,
  };
}

/**
 * Parse query parameters from URL query string
 */
export function parseQueryParams(query: Record<string, string>): QueryOptions {
  const options: QueryOptions = {};

  // Pagination
  if (query.page) {
    options.page = parseInt(query.page, 10);
  }
  if (query.limit) {
    options.limit = parseInt(query.limit, 10);
  }

  // Sorting
  if (query.sort) {
    options.sort = query.sort.split(',');
  }
  if (query.order && ['asc', 'desc'].includes(query.order.toLowerCase())) {
    options.order = query.order.toLowerCase() as 'asc' | 'desc';
  }

  // Field selection
  if (query.select) {
    options.select = query.select.split(',');
  }

  // Filters (JSON string or individual fields)
  if (query.filter) {
    try {
      options.filters = JSON.parse(query.filter);
    } catch (e) {
      // If filter is not valid JSON, treat as simple key=value
      options.filters = {};
      for (const [key, value] of Object.entries(query)) {
        if (!['page', 'limit', 'sort', 'order', 'select', 'filter'].includes(key)) {
          options.filters[key] = value;
        }
      }
    }
  } else {
    // Extract filters from remaining query params
    options.filters = {};
    for (const [key, value] of Object.entries(query)) {
      if (!['page', 'limit', 'sort', 'order', 'select'].includes(key)) {
        options.filters[key] = value;
      }
    }
  }

  return options;
}
