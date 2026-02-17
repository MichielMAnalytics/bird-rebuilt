export interface PaginationOptions {
  maxPages?: number;
  count?: number;
}

export interface PageResult<T> {
  items: T[];
  cursor?: string;
  hasMore: boolean;
}

export async function paginateWithCursor<T>(
  fetchPage: (cursor?: string) => Promise<PageResult<T>>,
  options: PaginationOptions = {}
): Promise<T[]> {
  const maxPages = options.maxPages ?? 1;
  const allItems: T[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchPage(cursor);
    allItems.push(...result.items);
    if (!result.hasMore || !result.cursor) break;
    cursor = result.cursor;
  }

  return allItems;
}
