export interface PaginationFlags {
  count?: number;
  cursor?: string;
  pages?: number;
}

export function addPaginationOptions(command: any): any {
  return command
    .option('-n, --count <number>', 'Number of items per page', '20')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--pages <number>', 'Number of pages to fetch', '1');
}

export function getPaginationFlags(options: any): PaginationFlags {
  return {
    count: options.count ? parseInt(options.count, 10) : undefined,
    cursor: options.cursor,
    pages: options.pages ? parseInt(options.pages, 10) : undefined,
  };
}
