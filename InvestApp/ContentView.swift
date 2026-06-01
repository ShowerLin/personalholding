import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Dashboard", systemImage: "chart.line.uptrend.xyaxis")
                }

            HoldingsView()
                .tabItem {
                    Label("Holdings", systemImage: "list.bullet.rectangle")
                }

            AccountsView()
                .tabItem {
                    Label("Accounts", systemImage: "building.columns")
                }
        }
    }
}

struct DashboardView: View {
    @EnvironmentObject private var store: PortfolioStore

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    ProfilePicker()

                    SummaryPanel(
                        title: "Total market value",
                        value: currency(store.totalMarketValue),
                        subtitle: "Cost basis \(currency(store.totalCostBasis))"
                    )

                    HStack(spacing: 12) {
                        MetricTile(
                            title: "Unrealized P&L",
                            value: currency(store.totalGain),
                            tint: store.totalGain >= 0 ? .green : .red
                        )
                        MetricTile(
                            title: "Return",
                            value: percent(store.totalGainPercent),
                            tint: store.totalGain >= 0 ? .green : .red
                        )
                    }

                    Text("By Account")
                        .font(.headline)

                    ForEach(store.accounts) { account in
                        AccountPerformanceRow(account: account)
                    }
                }
                .padding()
            }
            .navigationTitle("Investments")
        }
    }
}

struct HoldingsView: View {
    @EnvironmentObject private var store: PortfolioStore
    @State private var isAddingHolding = false

    var body: some View {
        NavigationView {
            List {
                Section {
                    ProfilePicker()
                }

                ForEach(store.holdings) { holding in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(holding.symbol)
                                    .font(.headline)
                                Text(holding.name)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(currency(holding.marketValue, code: holding.currency))
                                    .font(.headline)
                                Text("\(currency(holding.unrealizedGain, code: holding.currency)) \(percent(holding.unrealizedGainPercent))")
                                    .font(.caption)
                                    .foregroundColor(holding.unrealizedGain >= 0 ? .green : .red)
                            }
                        }
                        Text("\(store.accountName(for: holding)) - \(holding.quantity, specifier: "%.4g") shares")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .onDelete(perform: store.deleteHoldings)
            }
            .navigationTitle("Holdings")
            .toolbar {
                Button {
                    isAddingHolding = true
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(store.accounts.isEmpty)
            }
            .sheet(isPresented: $isAddingHolding) {
                AddHoldingView()
            }
        }
    }
}

struct AccountsView: View {
    @EnvironmentObject private var store: PortfolioStore
    @State private var isAddingAccount = false

    var body: some View {
        NavigationView {
            List {
                Section {
                    ProfilePicker()
                }

                ForEach(store.accounts) { account in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(account.name)
                            .font(.headline)
                        Text("\(account.broker) - \(account.baseCurrency)")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .onDelete(perform: store.deleteAccounts)
            }
            .navigationTitle("Broker Accounts")
            .toolbar {
                Button {
                    isAddingAccount = true
                } label: {
                    Image(systemName: "plus")
                }
            }
            .sheet(isPresented: $isAddingAccount) {
                AddAccountView()
            }
        }
    }
}

struct ProfilePicker: View {
    @EnvironmentObject private var store: PortfolioStore

    var body: some View {
        Picker("Portfolio", selection: $store.selectedProfileID) {
            ForEach(store.profiles) { profile in
                Text(profile.name).tag(profile.id)
            }
        }
        .pickerStyle(.segmented)
    }
}

struct SummaryPanel: View {
    let title: String
    let value: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline)
                .foregroundColor(.secondary)
            Text(value)
                .font(.system(size: 34, weight: .bold, design: .rounded))
            Text(subtitle)
                .font(.footnote)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(8)
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.headline)
                .foregroundColor(tint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(8)
    }
}

struct AccountPerformanceRow: View {
    @EnvironmentObject private var store: PortfolioStore
    let account: BrokerAccount

    private var holdings: [Holding] {
        store.holdings(for: account)
    }

    private var marketValue: Double {
        holdings.reduce(0) { $0 + $1.marketValue }
    }

    private var gain: Double {
        holdings.reduce(0) { $0 + $1.unrealizedGain }
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(account.name)
                    .font(.headline)
                Text(account.broker)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(currency(marketValue))
                    .font(.headline)
                Text(currency(gain))
                    .font(.caption)
                    .foregroundColor(gain >= 0 ? .green : .red)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(8)
    }
}

struct AddAccountView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: PortfolioStore
    @State private var name = ""
    @State private var broker = ""
    @State private var baseCurrency = "USD"

    var body: some View {
        NavigationView {
            Form {
                TextField("Account name", text: $name)
                TextField("Broker", text: $broker)
                TextField("Base currency", text: $baseCurrency)
                    .textInputAutocapitalization(.characters)
            }
            .navigationTitle("New Account")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        store.addAccount(name: name, broker: broker, baseCurrency: baseCurrency)
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }
}

struct AddHoldingView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: PortfolioStore
    @State private var accountID: UUID?
    @State private var symbol = ""
    @State private var name = ""
    @State private var quantity = ""
    @State private var averageCost = ""
    @State private var currentPrice = ""
    @State private var currencyCode = "USD"

    var body: some View {
        NavigationView {
            Form {
                Picker("Account", selection: Binding(
                    get: { accountID ?? store.accounts.first?.id },
                    set: { accountID = $0 }
                )) {
                    ForEach(store.accounts) { account in
                        Text(account.name).tag(Optional(account.id))
                    }
                }

                TextField("Symbol", text: $symbol)
                    .textInputAutocapitalization(.characters)
                TextField("Name", text: $name)
                TextField("Quantity", text: $quantity)
                    .keyboardType(.decimalPad)
                TextField("Average cost", text: $averageCost)
                    .keyboardType(.decimalPad)
                TextField("Current price", text: $currentPrice)
                    .keyboardType(.decimalPad)
                TextField("Currency", text: $currencyCode)
                    .textInputAutocapitalization(.characters)
            }
            .navigationTitle("New Holding")
            .onAppear {
                accountID = accountID ?? store.accounts.first?.id
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        guard let accountID = accountID,
                              let quantity = Double(quantity),
                              let averageCost = Double(averageCost),
                              let currentPrice = Double(currentPrice) else { return }

                        store.addHolding(
                            accountID: accountID,
                            symbol: symbol,
                            name: name,
                            quantity: quantity,
                            averageCost: averageCost,
                            currentPrice: currentPrice,
                            currency: currencyCode
                        )
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
        }
    }

    private var canSave: Bool {
        accountID != nil &&
            !symbol.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            Double(quantity) != nil &&
            Double(averageCost) != nil &&
            Double(currentPrice) != nil
    }
}

private func currency(_ value: Double, code: String = "USD") -> String {
    let formatter = NumberFormatter.investmentCurrency
    formatter.currencyCode = code
    return formatter.string(from: NSNumber(value: value)) ?? "\(code) \(value)"
}

private func percent(_ value: Double) -> String {
    NumberFormatter.investmentPercent.string(from: NSNumber(value: value)) ?? "\(value * 100)%"
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
            .environmentObject(PortfolioStore())
    }
}
