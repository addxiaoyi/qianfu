const NUMERIC_ROUTE_ID_PATTERN = /^\d+$/;

export const isNumericRouteId = (value: string | null | undefined): value is string =>
  typeof value === 'string' && NUMERIC_ROUTE_ID_PATTERN.test(value);

const UUID_ROUTE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isServerRouteId = (value: string | null | undefined): value is string =>
  isNumericRouteId(value) || (typeof value === 'string' && UUID_ROUTE_ID_PATTERN.test(value));
