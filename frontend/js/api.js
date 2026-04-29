const API = (() => {
  const baseUrl = ""; // same origin when served by Flask

  async function request(path, { method = "GET", body, headers } = {}) {
    const res = await fetch(baseUrl + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const msg = (data && data.error) || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    // auth
    me: () => request("/api/auth/me"),
    login: (username, password) => request("/api/auth/login", { method: "POST", body: { username, password } }),
    logout: () => request("/api/auth/logout", { method: "POST" }),

    // products
    getProducts: (q = "") => request(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    addProduct: (p) => request("/api/products", { method: "POST", body: p }),
    updateProduct: (id, p) => request(`/api/products/${id}`, { method: "PUT", body: p }),
    deleteProduct: (id) => request(`/api/products/${id}`, { method: "DELETE" }),
    exportProductsCsvUrl: () => "/api/products/export.csv",

    // expenses
    getExpenses: ({ start = "", end = "" } = {}) => {
      const qs = new URLSearchParams();
      if (start) qs.set("start", start);
      if (end) qs.set("end", end);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      return request(`/api/expenses${suffix}`);
    },
    addExpense: (e) => request("/api/expenses", { method: "POST", body: e }),
    deleteExpense: (id) => request(`/api/expenses/${id}`, { method: "DELETE" }),
    exportExpensesCsvUrl: () => "/api/expenses/export.csv",

    // summary
    summary: () => request("/api/summary"),
  };
})();

