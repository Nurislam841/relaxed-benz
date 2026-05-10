/**
 * Pagination helpers — shared across modules.
 */

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  /** True when caller passed an explicit page or limit. Use to short-circuit
   *  to `findMany` without paging when both are undefined. */
  usePagination: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  data: T[]; // legacy alias
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  totalPages: number;
}

/**
 * Normalize raw page/limit to a PaginationParams object with sensible defaults.
 *
 * Default: page=1, limit=20, max limit=100.
 */
export function getPagination(
  rawPage?: number | string,
  rawLimit?: number | string,
  defaultLimit = 20,
  maxLimit = 100,
): PaginationParams {
  const usePagination = rawPage !== undefined || rawLimit !== undefined;
  const page = Math.max(1, Number(rawPage) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(rawLimit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit, usePagination };
}

/**
 * Wrap a list of items + a known total into the standard paginated response.
 */
export function toPaginatedResult<T>(
  items: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    data: items, // legacy alias
    total,
    page,
    limit,
    hasNext: page < totalPages,
    totalPages,
  };
}
