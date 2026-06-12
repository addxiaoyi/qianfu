#!/usr/bin/env python3
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


DEFAULT_DB_PATH = "/www/wwwroot/qianfu-app/prisma/dev.db"

REQUIRED_COLUMNS = (
    ("method", "TEXT"),
    ("endpoint", "TEXT"),
    ("user_agent", "TEXT"),
    ("session_id", "TEXT"),
    ("rechecked_at", "DATETIME"),
    ("recheck_status", "TEXT"),
    ("rechecked_by", "INTEGER"),
    ("hash", "TEXT"),
    ("previous_hash", "TEXT"),
)

REQUIRED_INDEXES = (
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON {table}(action)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON {table}(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_action ON {table}(created_at, action)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_created_at ON {table}(user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_rechecked_at ON {table}(rechecked_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_recheck_status ON {table}(recheck_status)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON {table}(ip_address)",
)


def main() -> int:
    db_path = Path(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DB_PATH)
    if not db_path.exists():
        print(f"database not found: {db_path}", file=sys.stderr)
        return 1

    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()
        table_name = detect_table_name(cursor)
        if table_name is None:
            print("audit log table not found", file=sys.stderr)
            return 1

        existing_columns = {
            row[1]
            for row in cursor.execute(f"PRAGMA table_info('{table_name}')").fetchall()
        }

        added = []
        for name, sql_type in REQUIRED_COLUMNS:
            if name in existing_columns:
                continue
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {name} {sql_type}")
            added.append(name)

        for statement in REQUIRED_INDEXES:
            cursor.execute(statement.format(table=table_name))

        conn.commit()
        print(f"{table_name} columns existing={len(existing_columns)} added={added}")
        return 0
    finally:
        conn.close()


def detect_table_name(cursor: sqlite3.Cursor) -> str | None:
    table_names = {
        row[0]
        for row in cursor.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }
    for candidate in ("audit_logs", "AuditLog"):
        if candidate in table_names:
            return candidate
    return None


if __name__ == "__main__":
    raise SystemExit(main())
