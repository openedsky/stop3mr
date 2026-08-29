export function parseListParams(searchParams: URLSearchParams, defaultLimit = 20) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? defaultLimit) || defaultLimit));
  const q = searchParams.get("q")?.trim() ?? "";
  return { page, limit, skip: (page - 1) * limit, q };
}

export function dateRange(from?: string | null, to?: string | null) {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) range.lte = d;
  }
  return Object.keys(range).length ? range : undefined;
}

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit) || 1) };
}

export function paginateItems<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const skip = (page - 1) * limit;
  return {
    items: items.slice(skip, skip + limit),
    pagination: paginationMeta(page, limit, total),
  };
}
