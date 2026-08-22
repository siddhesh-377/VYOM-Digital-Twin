"""
VYOM Backend — Backward-Compatible Auto Migrations
Adds missing columns to existing SQLite tables at startup so that schema
evolution never breaks older databases. Idempotent; never drops data.
"""
import logging
from sqlalchemy import inspect

from core.database import Base, engine

logger = logging.getLogger("vyom")

# Fallback SQL defaults for NOT NULL columns lacking a Python-side default.
_TYPE_DEFAULTS = {
    "VARCHAR": "''",
    "TEXT": "''",
    "FLOAT": "0",
    "INTEGER": "0",
    "BIGINT": "0",
    "BOOLEAN": "0",
    "JSON": "'{}'",
}


def _column_default_sql(col) -> str:
    """Build a DEFAULT clause for an added NOT NULL column."""
    d = getattr(col, "default", None)
    if d is not None and getattr(d, "is_scalar", False):
        arg = d.arg
        if isinstance(arg, bool):
            return f" DEFAULT {1 if arg else 0}"
        if isinstance(arg, (int, float)):
            return f" DEFAULT {arg}"
        return f" DEFAULT '{arg}'"
    compiled = str(col.type).upper()
    for type_prefix, sql_default in _TYPE_DEFAULTS.items():
        if compiled.startswith(type_prefix):
            return f" DEFAULT {sql_default}"
    return ""


def run_migrations() -> int:
    """Add any missing columns to existing tables. Returns count of columns added."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    added = 0
    with engine.connect() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # create_all will create fresh tables
            existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
            for col in table.columns:
                if col.name in existing_cols:
                    continue
                try:
                    col_sql = f'"{col.name}" {col.type.compile(engine.dialect)}'
                    null_sql = "" if col.nullable else " NOT NULL"
                    if not col.nullable:
                        col_sql += _column_default_sql(col)
                    conn.exec_driver_sql(
                        f'ALTER TABLE "{table.name}" ADD COLUMN {col_sql}{null_sql}'
                    )
                    added += 1
                    logger.info("Migration: added %s.%s", table.name, col.name)
                except Exception as e:
                    logger.warning("Migration skipped %s.%s: %s", table.name, col.name, e)
        if added:
            conn.commit()
    return added
