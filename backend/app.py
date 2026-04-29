import csv
import io
import os
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory, session, Response
from flask_cors import CORS

from db import close_db, get_db, init_db
from utils import as_float, as_int, hash_password, verify_password


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key-change-me")
    CORS(app, supports_credentials=True)

    init_db(app)
    app.teardown_appcontext(close_db)

    # --- Static frontend serving (keeps folders separated) ---
    # IMPORTANT: Do not use a catch-all "/<path:path>" route because it can
    # accidentally intercept "/api/..." requests and return 405 for POST.
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
    css_dir = os.path.join(frontend_dir, "css")
    js_dir = os.path.join(frontend_dir, "js")

    @app.get("/")
    def _index():
        return send_from_directory(frontend_dir, "index.html")

    @app.get("/css/<path:filename>")
    def _css(filename: str):
        return send_from_directory(css_dir, filename)

    @app.get("/js/<path:filename>")
    def _js(filename: str):
        return send_from_directory(js_dir, filename)

    # --- Auth (optional bonus) ---
    def _require_login():
        return session.get("user_id") is not None

    def _ensure_default_user():
        """
        Create a default user on first run:
        username: admin
        password: admin123
        """
        db = get_db()
        row = db.execute("SELECT id FROM users WHERE username = ?", ("admin",)).fetchone()
        if row is None:
            db.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                ("admin", hash_password("admin123")),
            )
            db.commit()

    # get_db() relies on Flask's app context, so create the default user inside one.
    with app.app_context():
        _ensure_default_user()

    @app.post("/api/auth/login")
    def auth_login():
        data = request.get_json(force=True, silent=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        db = get_db()
        user = db.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()

        if user is None or not verify_password(password, user["password_hash"]):
            return jsonify({"ok": False, "error": "Invalid username or password"}), 401

        session["user_id"] = user["id"]
        session["username"] = user["username"]
        return jsonify({"ok": True, "username": user["username"]})

    @app.post("/api/auth/logout")
    def auth_logout():
        session.clear()
        return jsonify({"ok": True})

    @app.get("/api/auth/me")
    def auth_me():
        if not _require_login():
            return jsonify({"ok": True, "authenticated": False})
        return jsonify(
            {
                "ok": True,
                "authenticated": True,
                "username": session.get("username"),
            }
        )

    # --- Products API ---
    @app.get("/api/products")
    def get_products():
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        q = (request.args.get("q") or "").strip()
        db = get_db()
        if q:
            rows = db.execute(
                """
                SELECT id, name, quantity, price, created_at, updated_at
                FROM products
                WHERE name LIKE ?
                ORDER BY id DESC
                """,
                (f"%{q}%",),
            ).fetchall()
        else:
            rows = db.execute(
                """
                SELECT id, name, quantity, price, created_at, updated_at
                FROM products
                ORDER BY id DESC
                """
            ).fetchall()
        items = [dict(r) for r in rows]
        return jsonify({"ok": True, "items": items})

    @app.post("/api/products")
    def add_product():
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        data = request.get_json(force=True, silent=True) or {}
        name = (data.get("name") or "").strip()
        quantity = as_int(data.get("quantity"), 0)
        price = as_float(data.get("price"), 0.0)
        if not name:
            return jsonify({"ok": False, "error": "Product name is required"}), 400
        if quantity < 0 or price < 0:
            return jsonify({"ok": False, "error": "Quantity/price must be >= 0"}), 400

        db = get_db()
        db.execute(
            "INSERT INTO products (name, quantity, price, updated_at) VALUES (?, ?, ?, datetime('now'))",
            (name, quantity, price),
        )
        db.commit()
        return jsonify({"ok": True})

    @app.put("/api/products/<int:product_id>")
    def update_product(product_id: int):
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        data = request.get_json(force=True, silent=True) or {}
        name = (data.get("name") or "").strip()
        quantity = as_int(data.get("quantity"), 0)
        price = as_float(data.get("price"), 0.0)
        if not name:
            return jsonify({"ok": False, "error": "Product name is required"}), 400
        if quantity < 0 or price < 0:
            return jsonify({"ok": False, "error": "Quantity/price must be >= 0"}), 400

        db = get_db()
        cur = db.execute(
            """
            UPDATE products
            SET name = ?, quantity = ?, price = ?, updated_at = datetime('now')
            WHERE id = ?
            """,
            (name, quantity, price, product_id),
        )
        db.commit()
        if cur.rowcount == 0:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True})

    @app.delete("/api/products/<int:product_id>")
    def delete_product(product_id: int):
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        db = get_db()
        cur = db.execute("DELETE FROM products WHERE id = ?", (product_id,))
        db.commit()
        if cur.rowcount == 0:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True})

    @app.get("/api/products/export.csv")
    def export_products_csv():
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        db = get_db()
        rows = db.execute(
            "SELECT id, name, quantity, price, created_at, updated_at FROM products ORDER BY id DESC"
        ).fetchall()

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["id", "name", "quantity", "price", "created_at", "updated_at"])
        for r in rows:
            w.writerow([r["id"], r["name"], r["quantity"], r["price"], r["created_at"], r["updated_at"]])

        filename = f"products_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return Response(
            buf.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    # --- Expenses API ---
    @app.get("/api/expenses")
    def get_expenses():
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        start = (request.args.get("start") or "").strip()
        end = (request.args.get("end") or "").strip()
        db = get_db()

        where = []
        args = []
        if start:
            where.append("date >= ?")
            args.append(start)
        if end:
            where.append("date <= ?")
            args.append(end)

        sql = """
            SELECT id, category, amount, date, note, created_at
            FROM expenses
        """
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY date DESC, id DESC"

        rows = db.execute(sql, args).fetchall()
        items = [dict(r) for r in rows]
        return jsonify({"ok": True, "items": items})

    @app.post("/api/expenses")
    def add_expense():
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        data = request.get_json(force=True, silent=True) or {}
        category = (data.get("category") or "").strip()
        amount = as_float(data.get("amount"), 0.0)
        date = (data.get("date") or "").strip()
        note = (data.get("note") or "").strip() or None
        if not category:
            return jsonify({"ok": False, "error": "Category is required"}), 400
        if amount < 0:
            return jsonify({"ok": False, "error": "Amount must be >= 0"}), 400
        if not date:
            return jsonify({"ok": False, "error": "Date is required (YYYY-MM-DD)"}), 400

        db = get_db()
        db.execute(
            "INSERT INTO expenses (category, amount, date, note) VALUES (?, ?, ?, ?)",
            (category, amount, date, note),
        )
        db.commit()
        return jsonify({"ok": True})

    @app.delete("/api/expenses/<int:expense_id>")
    def delete_expense(expense_id: int):
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        db = get_db()
        cur = db.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
        db.commit()
        if cur.rowcount == 0:
            return jsonify({"ok": False, "error": "Not found"}), 404
        return jsonify({"ok": True})

    @app.get("/api/expenses/export.csv")
    def export_expenses_csv():
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        db = get_db()
        rows = db.execute(
            "SELECT id, category, amount, date, note, created_at FROM expenses ORDER BY date DESC, id DESC"
        ).fetchall()

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["id", "category", "amount", "date", "note", "created_at"])
        for r in rows:
            w.writerow([r["id"], r["category"], r["amount"], r["date"], r["note"] or "", r["created_at"]])

        filename = f"expenses_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        return Response(
            buf.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    # --- Dashboard summary ---
    @app.get("/api/summary")
    def summary():
        if not _require_login():
            return jsonify({"ok": False, "error": "Unauthorized"}), 401

        db = get_db()
        inv = db.execute("SELECT COALESCE(SUM(quantity * price), 0) AS inventory_value FROM products").fetchone()
        exp = db.execute("SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM expenses").fetchone()

        return jsonify(
            {
                "ok": True,
                "inventory_value": float(inv["inventory_value"] or 0),
                "total_expenses": float(exp["total_expenses"] or 0),
            }
        )

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="127.0.0.1", port=5000, debug=True)

if __name__ == "__main__":
    app.run()
