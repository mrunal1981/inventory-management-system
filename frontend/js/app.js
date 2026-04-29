function $(sel) {
  return document.querySelector(sel);
}
function $all(sel) {
  return Array.from(document.querySelectorAll(sel));
}

function formatINR(value) {
  const n = Number(value || 0);
  const v = Number.isFinite(n) ? n : 0;
  return "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("is-show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("is-show"), 2200);
}

function ymdToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthlySummary(expenses) {
  const map = new Map();
  for (const e of expenses) {
    const month = String(e.date || "").slice(0, 7); // YYYY-MM
    const amt = Number(e.amount || 0);
    map.set(month, (map.get(month) || 0) + (Number.isFinite(amt) ? amt : 0));
  }
  const out = Array.from(map.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return out;
}

function calcTotalExpenses(expenses) {
  return expenses.reduce((sum, e) => sum + (Number(e.amount || 0) || 0), 0);
}

function calcInventoryValue(products) {
  return products.reduce((sum, p) => sum + (Number(p.quantity || 0) * Number(p.price || 0) || 0), 0);
}

async function ensureAuthed() {
  const me = await API.me();
  return me.authenticated === true;
}

function setAuthedUI({ authenticated, username }) {
  const overlay = $("#loginOverlay");
  if (authenticated) {
    document.body.dataset.theme = currentView || "dashboard";
    $("#appRoot")?.classList.remove("is-locked");
    if (overlay && !overlay.classList.contains("is-hidden")) {
      overlay.classList.add("is-leaving");
      setTimeout(() => {
        overlay.classList.add("is-hidden");
        overlay.classList.remove("is-leaving");
      }, 230);
    }

    // When we were logged out, views were hidden. Ensure the current view is shown.
    const activeEl = $(`#view-${currentView || "dashboard"}`);
    if (activeEl) {
      activeEl.classList.remove("is-hidden");
      activeEl.classList.add("is-active");
      activeEl.classList.remove("view--leave", "view--enter", "view--pre");
    }
  } else {
    document.body.dataset.theme = "login";
    $("#appRoot")?.classList.add("is-locked");
    if (overlay) overlay.classList.remove("is-hidden", "is-leaving");
  }

  if (!authenticated) {
    // Hide all app views when signed out; view switching manages visibility otherwise.
    $all(".view").forEach((v) => v.classList.add("is-hidden"));
  }
  $("#logoutBtn").style.visibility = authenticated ? "visible" : "hidden";
  $("#meName").textContent = authenticated ? username : "Not signed in";
}

let currentView = "dashboard";
let viewAnimToken = 0;

function setView(view, { force = false } = {}) {
  const next = String(view || "dashboard");
  if (!force && next === currentView) return;

  document.body.dataset.theme = next;

  $all(".nav__item").forEach((b) => b.classList.toggle("is-active", b.dataset.view === next));

  const prevEl = $(`#view-${currentView}`);
  const nextEl = $(`#view-${next}`);
  currentView = next;

  if (!nextEl) return;

  const token = ++viewAnimToken;

  // Prepare next view (make visible but "pre" state)
  nextEl.classList.remove("is-hidden");
  nextEl.classList.remove("view--leave", "view--enter");
  nextEl.classList.add("view--pre");

  // Animate previous out (if exists & visible)
  if (prevEl && !prevEl.classList.contains("is-hidden")) {
    prevEl.classList.remove("view--enter", "view--pre");
    prevEl.classList.add("view--leave");
  }

  // Enter next on next paint so transitions fire.
  requestAnimationFrame(() => {
    if (token !== viewAnimToken) return;
    nextEl.classList.remove("view--pre");
    nextEl.classList.add("view--enter");
    setTimeout(() => {
      if (token !== viewAnimToken) return;
      nextEl.classList.remove("view--enter", "view--pre", "view--leave");
      nextEl.classList.add("is-active");

      // Hide previous after animation finishes
      if (prevEl && prevEl !== nextEl) {
        prevEl.classList.add("is-hidden");
        prevEl.classList.remove("is-active", "view--leave", "view--enter", "view--pre");
      }
    }, 230);
  });

  const title = view.charAt(0).toUpperCase() + view.slice(1);
  $("#viewTitle").textContent = title;
}

function initSidebar() {
  $("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("is-open"));
  $all(".nav__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      setView(btn.dataset.view);
      $("#sidebar").classList.remove("is-open");
    });
  });
}

function initCalculator() {
  const keys = [
    "7",
    "8",
    "9",
    "/",
    "4",
    "5",
    "6",
    "*",
    "1",
    "2",
    "3",
    "-",
    "0",
    ".",
    "C",
    "+",
    "(",
    ")",
    "⌫",
    "=",
  ];

  const grid = $("#calcKeys");
  const display = $("#calcDisplay");
  let expr = "";

  function render() {
    display.value = expr || "0";
  }

  function safeEval(s) {
    // Allow only digits, operators and parentheses to reduce risk.
    if (!/^[0-9+\-*/().\s]+$/.test(s)) throw new Error("Invalid input");
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${s});`)();
  }

  for (const k of keys) {
    const b = document.createElement("div");
    b.className = "calc__key";
    b.textContent = k;
    if ("+-*/".includes(k)) b.classList.add("is-op");
    if (k === "C" || k === "⌫") b.classList.add("is-danger");
    if (k === "=") b.classList.add("is-ok");
    b.addEventListener("click", () => {
      if (k === "C") {
        expr = "";
        render();
        return;
      }
      if (k === "⌫") {
        expr = expr.slice(0, -1);
        render();
        return;
      }
      if (k === "=") {
        try {
          const out = safeEval(expr || "0");
          expr = String(out);
        } catch {
          toast("Invalid expression");
        }
        render();
        return;
      }
      expr += k;
      render();
    });
    grid.appendChild(b);
  }
  render();

  $("#gstBtn").addEventListener("click", () => {
    const amount = Number($("#gstAmount").value || 0);
    const pct = Number($("#gstPercent").value || 0);
    const total = amount + (amount * pct) / 100;
    $("#gstOut").textContent = `Total: ${formatINR(total)}`;
  });

  $("#plBtn").addEventListener("click", () => {
    const rev = Number($("#plRevenue").value || 0);
    const cost = Number($("#plCost").value || 0);
    const other = Number($("#plOther").value || 0);
    const profit = rev - cost - other;
    Storage.setProfit(profit);
    $("#plOut").textContent = `Result: ${formatINR(profit)}`;
    toast("Saved profit to dashboard");
    refreshDashboardCards().catch(() => {});
  });
}

function renderProductsTable(items) {
  const tbody = $("#productsTable tbody");
  tbody.innerHTML = "";

  for (const p of items) {
    const tr = document.createElement("tr");
    const value = Number(p.quantity) * Number(p.price);
    tr.innerHTML = `
      <td>${escapeHtml(p.name)}</td>
      <td class="num">${Number(p.quantity)}</td>
      <td class="num">${formatINR(p.price)}</td>
      <td class="num">${formatINR(value)}</td>
      <td class="actions"></td>
    `;

    const actions = tr.querySelector(".actions");

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn--ghost tagbtn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", async () => {
      const name = prompt("Product name", p.name);
      if (name == null) return;
      const qty = prompt("Quantity", String(p.quantity));
      if (qty == null) return;
      const price = prompt("Price", String(p.price));
      if (price == null) return;

      try {
        await API.updateProduct(p.id, { name: name.trim(), quantity: Number(qty), price: Number(price) });
        toast("Updated product");
        await refreshInventory();
        await refreshDashboard();
      } catch (e) {
        toast(e.message || "Update failed");
      }
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn--danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      if (!confirm("Delete this product?")) return;
      try {
        await API.deleteProduct(p.id);
        toast("Deleted product");
        await refreshInventory();
        await refreshDashboard();
      } catch (e) {
        toast(e.message || "Delete failed");
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    tbody.appendChild(tr);
  }
}

function renderExpensesTable(items) {
  const tbody = $("#expensesTable tbody");
  tbody.innerHTML = "";

  for (const e of items) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(e.date)}</td>
      <td>${escapeHtml(e.category)}</td>
      <td class="num">${formatINR(e.amount)}</td>
      <td>${escapeHtml(e.note || "")}</td>
      <td class="actions"></td>
    `;

    const actions = tr.querySelector(".actions");
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn--danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      if (!confirm("Delete this expense?")) return;
      try {
        await API.deleteExpense(e.id);
        toast("Deleted expense");
        await refreshExpenses();
        await refreshDashboard();
      } catch (err) {
        toast(err.message || "Delete failed");
      }
    });
    actions.appendChild(delBtn);
    tbody.appendChild(tr);
  }
}

function renderMonthlyTable(monthly) {
  const tbody = $("#monthlyTable tbody");
  tbody.innerHTML = "";
  for (const m of monthly) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(m.month)}</td><td class="num">${formatINR(m.total)}</td>`;
    tbody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let state = {
  products: [],
  expenses: [],
  expenseFilter: { start: "", end: "" },
};

async function refreshInventory(query = "") {
  const res = await API.getProducts(query);
  state.products = res.items || [];
  renderProductsTable(state.products);
  $("#invMsg").textContent = query ? `Showing results for "${query}"` : "";
  return state.products;
}

async function refreshExpenses() {
  const res = await API.getExpenses(state.expenseFilter);
  state.expenses = res.items || [];
  renderExpensesTable(state.expenses);

  const total = calcTotalExpenses(state.expenses);
  $("#totalExpensesBig").textContent = formatINR(total);

  const monthly = monthlySummary(state.expenses);
  renderMonthlyTable(monthly);

  return state.expenses;
}

async function refreshDashboardCards() {
  $("#cardProfit").textContent = formatINR(Storage.getProfit());
  const summary = await API.summary();
  $("#cardExpenses").textContent = formatINR(summary.total_expenses);
  $("#cardInventory").textContent = formatINR(summary.inventory_value);
}

async function refreshDashboard() {
  await refreshDashboardCards();

  const monthly = monthlySummary(state.expenses);
  Charts.renderExpensesMonthly($("#expensesChart"), monthly);
  Charts.renderInventoryTop($("#inventoryChart"), state.products);
}

function initInventory() {
  $("#addProductBtn").addEventListener("click", async () => {
    const name = $("#pName").value.trim();
    const quantity = Number($("#pQty").value || 0);
    const price = Number($("#pPrice").value || 0);
    try {
      await API.addProduct({ name, quantity, price });
      $("#pName").value = "";
      $("#pQty").value = "";
      $("#pPrice").value = "";
      toast("Added product");
      await refreshInventory($("#productSearch").value.trim());
      await refreshDashboard();
    } catch (e) {
      toast(e.message || "Add failed");
    }
  });

  let t = null;
  $("#productSearch").addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const q = $("#productSearch").value.trim();
      try {
        await refreshInventory(q);
        await refreshDashboard();
      } catch (e) {
        toast(e.message || "Search failed");
      }
    }, 250);
  });

  $("#exportProductsBtn").addEventListener("click", () => {
    window.location.href = API.exportProductsCsvUrl();
  });
}

function initExpenses() {
  $("#eDate").value = ymdToday();

  $("#addExpenseBtn").addEventListener("click", async () => {
    const category = $("#eCategory").value.trim();
    const amount = Number($("#eAmount").value || 0);
    const date = $("#eDate").value;
    const note = $("#eNote").value.trim();
    try {
      await API.addExpense({ category, amount, date, note });
      $("#eCategory").value = "";
      $("#eAmount").value = "";
      $("#eNote").value = "";
      toast("Added expense");
      await refreshExpenses();
      await refreshDashboard();
    } catch (e) {
      toast(e.message || "Add failed");
    }
  });

  $("#filterExpensesBtn").addEventListener("click", async () => {
    state.expenseFilter = { start: $("#expStart").value, end: $("#expEnd").value };
    try {
      await refreshExpenses();
      await refreshDashboard();
      toast("Filter applied");
    } catch (e) {
      toast(e.message || "Filter failed");
    }
  });

  $("#exportExpensesBtn").addEventListener("click", () => {
    window.location.href = API.exportExpensesCsvUrl();
  });
}

function initBackup() {
  $("#backupBtn").addEventListener("click", () => {
    Storage.saveBackup({
      products: state.products,
      expenses: state.expenses,
      profit: Storage.getProfit(),
      expenseFilter: state.expenseFilter,
    });
    toast("Saved backup to local storage");
  });

  $("#restoreBtn").addEventListener("click", () => {
    const doc = Storage.loadBackup();
    if (!doc || !doc.payload) {
      toast("No local backup found");
      return;
    }
    const p = doc.payload;
    state.products = Array.isArray(p.products) ? p.products : [];
    state.expenses = Array.isArray(p.expenses) ? p.expenses : [];
    state.expenseFilter = p.expenseFilter || { start: "", end: "" };
    Storage.setProfit(p.profit || 0);

    renderProductsTable(state.products);
    renderExpensesTable(state.expenses);
    $("#totalExpensesBig").textContent = formatINR(calcTotalExpenses(state.expenses));
    renderMonthlyTable(monthlySummary(state.expenses));
    refreshDashboard().catch(() => {});
    toast("Restored from local storage (offline view)");
  });
}

async function initAuth() {
  async function refreshMe() {
    const me = await API.me();
    setAuthedUI({ authenticated: me.authenticated, username: me.username || "" });
    return me;
  }

  $("#loginBtn").addEventListener("click", async () => {
    $("#loginMsg").textContent = "";
    try {
      const u = $("#loginUser").value.trim() || "admin";
      const p = $("#loginPass").value || "admin123";
      await API.login(u, p);
      toast("Signed in");
      await refreshMe();
      setView("dashboard", { force: true });
      await bootstrapData();
    } catch (e) {
      $("#loginMsg").textContent = e.message || "Login failed";
    }
  });

  $("#logoutBtn").addEventListener("click", async () => {
    try {
      await API.logout();
      toast("Logged out");
    } finally {
      setView("dashboard", { force: true });
      setAuthedUI({ authenticated: false, username: "" });
      document.body.dataset.theme = "login";
    }
  });

  return refreshMe();
}

async function bootstrapData() {
  await Promise.all([refreshInventory(""), refreshExpenses()]);
  await refreshDashboard();
}

async function main() {
  initSidebar();
  initCalculator();
  initInventory();
  initExpenses();
  initBackup();

  // Initial view: show immediately (no transition), mark active.
  $all(".nav__item").forEach((b) => b.classList.toggle("is-active", b.dataset.view === "dashboard"));
  $all(".view").forEach((v) => v.classList.add("is-hidden"));
  const dash = $("#view-dashboard");
  if (dash) {
    dash.classList.remove("is-hidden");
    dash.classList.add("is-active");
  }
  currentView = "dashboard";
  document.body.dataset.theme = "login";
  $("#cardProfit").textContent = formatINR(Storage.getProfit());

  try {
    const me = await initAuth();
    if (me.authenticated) {
      await bootstrapData();
    }
  } catch (e) {
    setAuthedUI({ authenticated: false, username: "" });
    $("#loginMsg").textContent = "Backend not reachable. You can still restore from local backup.";
  }
}

window.addEventListener("DOMContentLoaded", main);

