const Charts = (() => {
  let expensesChart = null;
  let inventoryChart = null;

  function _destroy(chart) {
    if (chart) chart.destroy();
  }

  function renderExpensesMonthly(canvas, monthly) {
    _destroy(expensesChart);
    const labels = monthly.map((m) => m.month);
    const data = monthly.map((m) => m.total);

    expensesChart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Expenses",
            data,
            tension: 0.35,
            borderColor: "#59d0ff",
            backgroundColor: "rgba(89,208,255,.15)",
            fill: true,
            pointRadius: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "rgba(232,236,255,.7)" }, grid: { color: "rgba(255,255,255,.06)" } },
          y: { ticks: { color: "rgba(232,236,255,.7)" }, grid: { color: "rgba(255,255,255,.06)" } },
        },
      },
    });
  }

  function renderInventoryTop(canvas, items) {
    _destroy(inventoryChart);
    const top = [...items]
      .map((p) => ({ name: p.name, value: Number(p.quantity) * Number(p.price) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    inventoryChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: top.map((t) => t.name),
        datasets: [
          {
            label: "Stock value",
            data: top.map((t) => t.value),
            borderRadius: 10,
            backgroundColor: "rgba(109,94,252,.35)",
            borderColor: "rgba(109,94,252,.75)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "rgba(232,236,255,.7)" }, grid: { display: false } },
          y: { ticks: { color: "rgba(232,236,255,.7)" }, grid: { color: "rgba(255,255,255,.06)" } },
        },
      },
    });
  }

  return { renderExpensesMonthly, renderInventoryTop };
})();

