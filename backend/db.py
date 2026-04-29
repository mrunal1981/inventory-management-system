import os
import sqlite3
from pathlib import Path

from flask import g


def _db_path() -> str:
    # Keep DB file inside backend/ so frontend remains static.
    base_dir = Path(__file__).resolve().parent
    return str(base_dir / "data.sqlite3")


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(_db_path(), detect_types=sqlite3.PARSE_DECLTYPES)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        g.db = conn
    return g.db


def close_db(_e=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(app) -> None:
    schema_path = Path(__file__).resolve().parent / "schema.sql"
    schema_sql = schema_path.read_text(encoding="utf-8")
    Path(_db_path()).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(_db_path())
    try:
        conn.executescript(schema_sql)
        conn.commit()
    finally:
        conn.close()

    app.logger.info("SQLite DB ready at %s", _db_path())

