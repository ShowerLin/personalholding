const STORAGE_KEY = "investapp.web.portfolios.v1";
const HOSTED_HOLDINGS_URL = "./data/holdings.csv";

const templateColumns = [
  "account_name",
  "broker",
  "asset_type",
  "symbol",
  "asset_name",
  "quantity",
  "average_cost",
  "current_price",
  "currency",
  "as_of_date",
  "market",
  "isin",
  "notes"
];

const state = {
  activeProfile: "personal",
  activeTab: "dashboard",
  pendingImport: []
};

const defaultData = {
  profiles: {
    personal: {
      name: "Personal",
      accounts: [
        { id: crypto.randomUUID(), name: "Long-term HK", broker: "Interactive Brokers", baseCurrency: "HKD" },
        { id: crypto.randomUUID(), name: "US growth", broker: "Charles Schwab", baseCurrency: "USD" }
      ],
      holdings: []
    },
    official: {
      name: "Official",
      accounts: [],
      holdings: []
    }
  }
};

defaultData.profiles.personal.holdings = [
  {
    id: crypto.randomUUID(),
    accountId: defaultData.profiles.personal.accounts[0].id,
    assetType: "ETF",
    symbol: "2800.HK",
    assetName: "Tracker Fund of Hong Kong",
    quantity: 800,
    averageCost: 18.2,
    currentPrice: 19.46,
    currency: "HKD",
    asOfDate: "",
    market: "HK",
    isin: "",
    notes: ""
  },
  {
    id: crypto.randomUUID(),
    accountId: defaultData.profiles.personal.accounts[1].id,
    assetType: "ETF",
    symbol: "VOO",
    assetName: "Vanguard S&P 500 ETF",
    quantity: 12,
    averageCost: 428,
    currentPrice: 471.2,
    currency: "USD",
    asOfDate: "",
    market: "US",
    isin: "",
    notes: ""
  }
];

let data = loadData();

document.addEventListener("DOMContentLoaded", async () => {
  bindNavigation();
  bindForms();
  bindImport();
  await loadHostedCsv({ silent: true });
  render();
});

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(defaultData);

  try {
    const parsed = JSON.parse(stored);
    return parsed.profiles ? parsed : structuredClone(defaultData);
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function profile() {
  return data.profiles[state.activeProfile];
}

function bindNavigation() {
  document.querySelectorAll(".profile-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeProfile = button.dataset.profile;
      state.pendingImport = [];
      render();
    });
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      render();
    });
  });
}

function bindForms() {
  const holdingDialog = document.querySelector("#holdingDialog");
  const accountDialog = document.querySelector("#accountDialog");

  document.querySelector("#openHoldingForm").addEventListener("click", () => {
    resetHoldingForm();
    holdingDialog.showModal();
  });

  document.querySelector("#openAccountForm").addEventListener("click", () => {
    document.querySelector("#accountForm").reset();
    document.querySelector("#baseCurrency").value = "USD";
    accountDialog.showModal();
  });

  document.querySelector("#holdingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveHoldingFromForm();
    holdingDialog.close();
  });

  document.querySelector("#accountForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const current = profile();
    current.accounts.push({
      id: crypto.randomUUID(),
      name: value("#accountName"),
      broker: value("#broker"),
      baseCurrency: value("#baseCurrency").toUpperCase()
    });
    saveData();
    accountDialog.close();
    render();
  });
}

function bindImport() {
  document.querySelector("#downloadCsvTemplate").addEventListener("click", downloadCsvTemplate);
  document.querySelector("#downloadXlsxTemplate").addEventListener("click", downloadXlsxTemplate);
  document.querySelector("#loadHostedCsv").addEventListener("click", () => loadHostedCsv({ silent: false }));
  document.querySelector("#fileInput").addEventListener("change", handleFileSelect);
  document.querySelector("#confirmImport").addEventListener("click", confirmImport);
}

function render() {
  renderNavigation();
  renderSummary();
  renderAccounts();
  renderHoldings();
  renderImportPreview();
  populateAccountPicker();
}

function renderNavigation() {
  document.querySelectorAll(".profile-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.profile === state.activeProfile);
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.activeTab);
  });

  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.dataset.view === state.activeTab);
  });
}

function renderSummary() {
  const holdings = profile().holdings;
  const cost = holdings.reduce((sum, holding) => sum + costBasis(holding), 0);
  const valueTotal = holdings.reduce((sum, holding) => sum + marketValue(holding), 0);
  const pnl = valueTotal - cost;
  const returnPercent = cost === 0 ? 0 : pnl / cost;

  setText("#totalValue", money(valueTotal));
  setText("#totalCost", `Cost ${money(cost)}`);
  setText("#totalPnl", money(pnl));
  setText("#totalReturn", percent(returnPercent));
  setText("#accountCount", profile().accounts.length);
  setText("#holdingCount", `${holdings.length} holdings`);
  document.querySelector("#totalPnl").className = pnl >= 0 ? "positive" : "negative";
  document.querySelector("#totalReturn").className = pnl >= 0 ? "positive" : "negative";
}

function renderAccounts() {
  const performance = document.querySelector("#accountPerformance");
  const accountsList = document.querySelector("#accountsList");
  performance.innerHTML = "";
  accountsList.innerHTML = "";

  if (profile().accounts.length === 0) {
    performance.innerHTML = emptyState("No accounts yet.");
    accountsList.innerHTML = emptyState("Add your first broker account.");
    return;
  }

  profile().accounts.forEach((account) => {
    const holdings = profile().holdings.filter((holding) => holding.accountId === account.id);
    const valueTotal = holdings.reduce((sum, holding) => sum + marketValue(holding), 0);
    const pnl = holdings.reduce((sum, holding) => sum + gain(holding), 0);
    performance.appendChild(accountRow(account, valueTotal, pnl, false));
    accountsList.appendChild(accountRow(account, valueTotal, pnl, true));
  });
}

function accountRow(account, valueTotal, pnl, showDelete) {
  const row = document.createElement("article");
  row.className = "account-row";
  row.innerHTML = `
    <div>
      <strong>${escapeHtml(account.name)}</strong>
      <small>${escapeHtml(account.broker)} - ${escapeHtml(account.baseCurrency)}</small>
    </div>
    <div>
      <span>${money(valueTotal, account.baseCurrency)}</span>
      <small class="${pnl >= 0 ? "positive" : "negative"}">${money(pnl, account.baseCurrency)}</small>
    </div>
  `;

  if (showDelete) {
    const actions = document.createElement("div");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "text-button danger";
    button.textContent = "Delete";
    button.addEventListener("click", () => deleteAccount(account.id));
    actions.appendChild(button);
    row.appendChild(actions);
  }

  return row;
}

function renderHoldings() {
  const table = document.querySelector("#holdingsTable");
  table.innerHTML = "";

  if (profile().holdings.length === 0) {
    table.innerHTML = `<tr><td colspan="6">No holdings yet.</td></tr>`;
    return;
  }

  profile().holdings.forEach((holding) => {
    const account = profile().accounts.find((item) => item.id === holding.accountId);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(holding.symbol)}</strong><small>${escapeHtml(holding.assetName || holding.assetType)}</small></td>
      <td>${escapeHtml(account?.name || "Unassigned")}<small>${escapeHtml(account?.broker || "")}</small></td>
      <td>${formatNumber(holding.quantity)}</td>
      <td>${money(marketValue(holding), holding.currency)}<small>${money(holding.currentPrice, holding.currency)} price</small></td>
      <td class="${gain(holding) >= 0 ? "positive" : "negative"}">${money(gain(holding), holding.currency)}<small>${percent(returnRate(holding))}</small></td>
      <td></td>
    `;

    const actionsCell = row.lastElementChild;
    const edit = document.createElement("button");
    edit.className = "text-button";
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editHolding(holding.id));
    const remove = document.createElement("button");
    remove.className = "text-button danger";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteHolding(holding.id));
    actionsCell.append(edit, remove);
    table.appendChild(row);
  });
}

function populateAccountPicker() {
  const picker = document.querySelector("#holdingAccount");
  picker.innerHTML = "";
  profile().accounts.forEach((account) => {
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = `${account.name} (${account.broker})`;
    picker.appendChild(option);
  });
}

function resetHoldingForm() {
  document.querySelector("#holdingForm").reset();
  document.querySelector("#holdingId").value = "";
  document.querySelector("#holdingDialogTitle").textContent = "Add holding";
  document.querySelector("#currency").value = "USD";
  populateAccountPicker();
}

function editHolding(id) {
  const holding = profile().holdings.find((item) => item.id === id);
  if (!holding) return;

  document.querySelector("#holdingDialogTitle").textContent = "Edit holding";
  document.querySelector("#holdingId").value = holding.id;
  document.querySelector("#holdingAccount").value = holding.accountId;
  document.querySelector("#assetType").value = holding.assetType;
  document.querySelector("#symbol").value = holding.symbol;
  document.querySelector("#assetName").value = holding.assetName;
  document.querySelector("#quantity").value = holding.quantity;
  document.querySelector("#averageCost").value = holding.averageCost;
  document.querySelector("#currentPrice").value = holding.currentPrice;
  document.querySelector("#currency").value = holding.currency;
  document.querySelector("#asOfDate").value = holding.asOfDate || "";
  document.querySelector("#market").value = holding.market || "";
  document.querySelector("#isin").value = holding.isin || "";
  document.querySelector("#notes").value = holding.notes || "";
  document.querySelector("#holdingDialog").showModal();
}

function saveHoldingFromForm() {
  const id = value("#holdingId") || crypto.randomUUID();
  const updated = {
    id,
    accountId: value("#holdingAccount"),
    assetType: value("#assetType"),
    symbol: value("#symbol").toUpperCase(),
    assetName: value("#assetName"),
    quantity: Number(value("#quantity")),
    averageCost: Number(value("#averageCost")),
    currentPrice: Number(value("#currentPrice")),
    currency: value("#currency").toUpperCase(),
    asOfDate: value("#asOfDate"),
    market: value("#market").toUpperCase(),
    isin: value("#isin").toUpperCase(),
    notes: value("#notes")
  };

  const holdings = profile().holdings;
  const index = holdings.findIndex((holding) => holding.id === id);
  if (index >= 0) {
    holdings[index] = updated;
  } else {
    holdings.push(updated);
  }

  saveData();
  render();
}

function deleteHolding(id) {
  profile().holdings = profile().holdings.filter((holding) => holding.id !== id);
  saveData();
  render();
}

function deleteAccount(id) {
  profile().accounts = profile().accounts.filter((account) => account.id !== id);
  profile().holdings = profile().holdings.filter((holding) => holding.accountId !== id);
  saveData();
  render();
}

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const rows = file.name.toLowerCase().endsWith(".csv")
      ? parseCsv(await file.text())
      : await parseSpreadsheet(file);
    state.pendingImport = normalizeImportRows(rows);
    renderImportPreview();
  } catch (error) {
    state.pendingImport = [];
    setText("#importStatus", error.message);
    document.querySelector("#confirmImport").disabled = true;
  }
}

function parseSpreadsheet(file) {
  if (!window.XLSX) {
    throw new Error("XLSX import needs an internet connection to load the spreadsheet parser. CSV import is available now.");
  }

  return file.arrayBuffer().then((buffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift()?.map(normalizeHeader) || [];
  return rows
    .filter((item) => item.some((cell) => String(cell).trim()))
    .map((item) => Object.fromEntries(headers.map((header, index) => [header, item[index] || ""])));
}

function normalizeImportRows(rows) {
  return rows.map((row, index) => {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, item]) => [normalizeHeader(key), typeof item === "string" ? item.trim() : item])
    );

    const holding = {
      rowNumber: index + 2,
      accountName: textField(normalized.account_name),
      broker: textField(normalized.broker),
      assetType: textField(normalized.asset_type || "Other"),
      symbol: textField(normalized.symbol).toUpperCase(),
      assetName: textField(normalized.asset_name),
      quantity: Number(normalized.quantity),
      averageCost: Number(normalized.average_cost),
      currentPrice: Number(normalized.current_price),
      currency: textField(normalized.currency || "USD").toUpperCase(),
      asOfDate: textField(normalized.as_of_date),
      market: textField(normalized.market).toUpperCase(),
      isin: textField(normalized.isin).toUpperCase(),
      notes: textField(normalized.notes)
    };

    const errors = [];
    if (!holding.accountName) errors.push("account_name");
    if (!holding.broker) errors.push("broker");
    if (!holding.symbol) errors.push("symbol");
    if (!Number.isFinite(holding.quantity)) errors.push("quantity");
    if (!Number.isFinite(holding.averageCost)) errors.push("average_cost");
    if (!Number.isFinite(holding.currentPrice)) errors.push("current_price");
    if (!holding.currency) errors.push("currency");

    return { holding, errors };
  });
}

function renderImportPreview() {
  const status = document.querySelector("#importStatus");
  const preview = document.querySelector("#importPreview");
  const confirm = document.querySelector("#confirmImport");
  preview.innerHTML = "";

  if (state.pendingImport.length === 0) {
    status.textContent = "No file selected.";
    confirm.disabled = true;
    return;
  }

  const invalid = state.pendingImport.filter((item) => item.errors.length);
  status.textContent = `${state.pendingImport.length} rows found. ${invalid.length} need fixes.`;
  confirm.disabled = invalid.length > 0;

  state.pendingImport.slice(0, 80).forEach((item) => {
    const node = document.createElement("div");
    node.className = `preview-item ${item.errors.length ? "invalid" : ""}`;
    node.innerHTML = `
      <strong>${escapeHtml(item.holding.symbol || "Missing symbol")}</strong>
      <small>${escapeHtml(item.holding.accountName)} - ${escapeHtml(item.holding.broker)}</small>
      <small>${formatNumber(item.holding.quantity)} x ${money(item.holding.currentPrice, item.holding.currency)}</small>
      ${item.errors.length ? `<small class="negative">Missing or invalid: ${item.errors.join(", ")}</small>` : ""}
    `;
    preview.appendChild(node);
  });
}

function confirmImport() {
  const mode = document.querySelector("#importMode").value;
  importRowsIntoProfile(state.activeProfile, state.pendingImport, mode);

  state.pendingImport = [];
  document.querySelector("#fileInput").value = "";
  saveData();
  render();
}

function importRowsIntoProfile(profileKey, rows, mode) {
  const current = data.profiles[profileKey];
  if (!current) return;

  if (mode === "replace") {
    current.accounts = [];
    current.holdings = [];
  }

  rows.forEach(({ holding }) => {
    let account = current.accounts.find(
      (item) => item.name.toLowerCase() === holding.accountName.toLowerCase() && item.broker.toLowerCase() === holding.broker.toLowerCase()
    );

    if (!account) {
      account = {
        id: crypto.randomUUID(),
        name: holding.accountName,
        broker: holding.broker,
        baseCurrency: holding.currency
      };
      current.accounts.push(account);
    }

    current.holdings.push({
      id: crypto.randomUUID(),
      accountId: account.id,
      assetType: holding.assetType,
      symbol: holding.symbol,
      assetName: holding.assetName,
      quantity: holding.quantity,
      averageCost: holding.averageCost,
      currentPrice: holding.currentPrice,
      currency: holding.currency,
      asOfDate: holding.asOfDate,
      market: holding.market,
      isin: holding.isin,
      notes: holding.notes
    });
  });
}

async function loadHostedCsv({ silent }) {
  const status = document.querySelector("#staticDataStatus");

  try {
    const response = await fetch(`${HOSTED_HOLDINGS_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Hosted CSV not found (${response.status}).`);
    }

    const rows = parseCsv(await response.text());
    const imported = normalizeImportRows(rows);
    const invalid = imported.filter((item) => item.errors.length);
    if (invalid.length) {
      throw new Error(`${invalid.length} hosted CSV rows need fixes.`);
    }

    importRowsIntoProfile("official", imported, "replace");
    state.activeProfile = "official";
    saveData();
    if (status) status.textContent = `Hosted CSV loaded into Official: ${imported.length} holdings.`;
    if (!silent) render();
  } catch (error) {
    if (status) status.textContent = `Hosted CSV status: ${error.message}`;
    if (!silent) renderImportPreview();
  }
}

function downloadCsvTemplate() {
  const sample = [
    templateColumns,
    ["US growth", "Charles Schwab", "ETF", "VOO", "Vanguard S&P 500 ETF", "12", "428", "471.2", "USD", "2026-06-01", "US", "", ""],
    ["Long-term HK", "Interactive Brokers", "ETF", "2800.HK", "Tracker Fund of Hong Kong", "800", "18.2", "19.46", "HKD", "2026-06-01", "HK", "", ""]
  ];
  const csv = sample.map((row) => row.map(csvEscape).join(",")).join("\n");
  downloadBlob("investapp-holdings-template.csv", "text/csv;charset=utf-8", csv);
}

function downloadXlsxTemplate() {
  if (!window.XLSX) {
    downloadCsvTemplate();
    return;
  }

  const rows = [
    Object.fromEntries(templateColumns.map((column) => [column, ""])),
    {
      account_name: "US growth",
      broker: "Charles Schwab",
      asset_type: "ETF",
      symbol: "VOO",
      asset_name: "Vanguard S&P 500 ETF",
      quantity: 12,
      average_cost: 428,
      current_price: 471.2,
      currency: "USD",
      as_of_date: "2026-06-01",
      market: "US",
      isin: "",
      notes: ""
    }
  ];
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: templateColumns });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Holdings");
  XLSX.writeFile(workbook, "investapp-holdings-template.xlsx");
}

function costBasis(holding) {
  return Number(holding.quantity) * Number(holding.averageCost);
}

function marketValue(holding) {
  return Number(holding.quantity) * Number(holding.currentPrice);
}

function gain(holding) {
  return marketValue(holding) - costBasis(holding);
}

function returnRate(holding) {
  const cost = costBasis(holding);
  return cost === 0 ? 0 : gain(holding) / cost;
}

function money(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function percent(value) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(Number(value) || 0);
}

function normalizeHeader(header) {
  return String(header).trim().toLowerCase().replace(/\s+/g, "_");
}

function textField(value) {
  return String(value ?? "").trim();
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

function setText(selector, text) {
  document.querySelector(selector).textContent = text;
}

function emptyState(text) {
  return `<article class="account-row"><span class="muted">${escapeHtml(text)}</span></article>`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadBlob(fileName, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
