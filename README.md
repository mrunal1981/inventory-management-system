# Smart Business Calculator & Inventory Manager

Full-stack web app with a modern dark dashboard, calculators, inventory management, and expense tracking.

## Tech Stack

- Frontend: HTML, CSS, JavaScript (no React)
- Backend: Python (Flask)
- Database: SQLite
- Charts: Chart.js (CDN)

## Features

- Dashboard cards: Profit (local), Total Expenses, Inventory Value
- Charts: Monthly expenses + top inventory items
- Calculator module:
  - Basic calculator
  - GST calculator
  - Profit/Loss calculator (saved to local storage)
- Inventory management:
  - Add / edit / delete products
  - Search products
  - Auto stock value calculation
  - Export products as CSV
- Expense tracker:
  - Add / delete expenses
  - Filter by date range
  - Total expenses + monthly summary
  - Export expenses as CSV
- Local storage backup:
  - Backup current view data to local storage
  - Restore for offline viewing
- Bonus login:
  - Default user: `admin` / `admin123`

## Project Structure

```
Smart Business Calculator and Inventory Manager/
  backend/
    app.py
    db.py
    schema.sql
    utils.py
    requirements.txt
    data.sqlite3        # created on first run
  frontend/
    index.html
    css/
      styles.css
    js/
      api.js
      app.js
      charts.js
      storage.js
  README.md
```

## Setup & Run (Windows PowerShell)

From the project root:

```bash
cd "d:\projects\Smart Business Calculator and Inventory Manager"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r .\backend\requirements.txt
python .\backend\app.py
```

Open:

- `http://127.0.0.1:5000/`

## Notes

- SQLite file is created at `backend/data.sqlite3` automatically.
- Change the Flask secret in PowerShell if needed:

```bash
$env:FLASK_SECRET_KEY="your-long-random-secret"
python .\backend\app.py
```

