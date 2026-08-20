export type AuditTimeSeriesInterval = 'hour' | 'day';

export const buildPostgresAuditTimeSeriesQuery = (interval: AuditTimeSeriesInterval): string => {
  const dateFormat = interval === 'hour' ? 'YYYY-MM-DD HH24:00' : 'YYYY-MM-DD';

  return `SELECT TO_CHAR(created_at, '${dateFormat}') AS time, COUNT(*)::bigint AS count
          FROM "AuditLog"
          WHERE created_at >= $1
          GROUP BY TO_CHAR(created_at, '${dateFormat}')
          ORDER BY time ASC`;
};
