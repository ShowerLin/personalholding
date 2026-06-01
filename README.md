# InvestApp

InvestApp is a local-first, mobile-friendly web app / PWA for consolidating holdings across broker accounts.

## Web App Scope

- Switch between Personal and Official portfolio spaces.
- Add, edit, and delete holdings manually.
- Add and delete broker accounts manually.
- Import holdings with the standard CSV/XLSX template.
- Load a hosted static holdings file from `web/data/holdings.csv`.
- Preview and validate imports before saving.
- Append to or replace the current portfolio.
- Switch between Personal and Official portfolio spaces without reinstalling the app.
- Review total market value, cost basis, unrealized P&L, and return.
- See account-level totals.
- Store data in the browser with `localStorage`.

## Web Template Columns

Required:

```text
account_name, broker, asset_type, symbol, asset_name, quantity, average_cost, current_price, currency
```

Optional:

```text
as_of_date, market, isin, notes
```

## Run The Web App

From this folder:

```bash
python3 -m http.server 4173 -d web
```

Then open:

```text
http://127.0.0.1:4173
```

## Static Hosted Portfolio

For a GitHub Pages public demo, edit:

```text
web/data/holdings.csv
```

When the page opens, the app fetches that file and loads it into the `Official` portfolio space. Visitors can interact with the page, but their edits only affect their own browser storage; they do not change the CSV in GitHub.

## Good Next Steps

- Add broker-specific import presets.
- Add realized gains, dividends, deposits, withdrawals, and fees.
- Support FX conversion into a single reporting currency.
- Add price refresh using a market data provider.
- Add encrypted backup/export.
