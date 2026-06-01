import Foundation

final class PortfolioStore: ObservableObject {
    @Published var profiles: [PortfolioProfile] = [] {
        didSet { save() }
    }

    @Published var selectedProfileID = "personal" {
        didSet { save() }
    }

    private let fileName = "portfolio.json"

    init() {
        load()
    }

    var selectedProfile: PortfolioProfile {
        profiles.first(where: { $0.id == selectedProfileID }) ?? Self.defaultProfiles[0]
    }

    var accounts: [BrokerAccount] {
        selectedProfile.accounts
    }

    var holdings: [Holding] {
        selectedProfile.holdings
    }

    var totalCostBasis: Double {
        holdings.reduce(0) { $0 + $1.costBasis }
    }

    var totalMarketValue: Double {
        holdings.reduce(0) { $0 + $1.marketValue }
    }

    var totalGain: Double {
        totalMarketValue - totalCostBasis
    }

    var totalGainPercent: Double {
        guard totalCostBasis != 0 else { return 0 }
        return totalGain / totalCostBasis
    }

    func holdings(for account: BrokerAccount) -> [Holding] {
        holdings.filter { $0.accountID == account.id }
    }

    func accountName(for holding: Holding) -> String {
        accounts.first(where: { $0.id == holding.accountID })?.name ?? "Unassigned"
    }

    func addAccount(name: String, broker: String, baseCurrency: String) {
        let account = BrokerAccount(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            broker: broker.trimmingCharacters(in: .whitespacesAndNewlines),
            baseCurrency: baseCurrency.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        )
        mutateSelectedProfile { profile in
            profile.accounts.append(account)
        }
    }

    func addHolding(
        accountID: UUID,
        symbol: String,
        name: String,
        quantity: Double,
        averageCost: Double,
        currentPrice: Double,
        currency: String
    ) {
        let holding = Holding(
            accountID: accountID,
            symbol: symbol.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            quantity: quantity,
            averageCost: averageCost,
            currentPrice: currentPrice,
            currency: currency.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        )
        mutateSelectedProfile { profile in
            profile.holdings.append(holding)
        }
    }

    func deleteAccounts(at offsets: IndexSet) {
        mutateSelectedProfile { profile in
            let removedIDs = offsets.map { profile.accounts[$0].id }
            removeElements(from: &profile.accounts, at: offsets)
            profile.holdings.removeAll { removedIDs.contains($0.accountID) }
        }
    }

    func deleteHoldings(at offsets: IndexSet) {
        mutateSelectedProfile { profile in
            removeElements(from: &profile.holdings, at: offsets)
        }
    }

    private func load() {
        let url = storageURL()
        guard FileManager.default.fileExists(atPath: url.path) else {
            seedExampleData()
            return
        }

        do {
            let data = try Data(contentsOf: url)
            if let snapshot = try? JSONDecoder().decode(PortfolioSnapshot.self, from: data) {
                selectedProfileID = snapshot.selectedProfileID
                profiles = snapshot.profiles
            } else {
                let snapshot = try JSONDecoder().decode(LegacyPortfolioSnapshot.self, from: data)
                selectedProfileID = "personal"
                profiles = [
                    PortfolioProfile(
                        id: "personal",
                        name: "Personal",
                        accounts: snapshot.accounts,
                        holdings: snapshot.holdings
                    ),
                    PortfolioProfile(id: "official", name: "Official", accounts: [], holdings: [])
                ]
            }
        } catch {
            seedExampleData()
        }
    }

    private func save() {
        guard !profiles.isEmpty else { return }

        do {
            let snapshot = PortfolioSnapshot(selectedProfileID: selectedProfileID, profiles: profiles)
            let data = try JSONEncoder().encode(snapshot)
            try data.write(to: storageURL(), options: [.atomic])
        } catch {
            assertionFailure("Unable to save portfolio: \(error.localizedDescription)")
        }
    }

    private func storageURL() -> URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent(fileName)
    }

    private func seedExampleData() {
        let hk = BrokerAccount(name: "Long-term HK", broker: "Interactive Brokers", baseCurrency: "HKD")
        let us = BrokerAccount(name: "US growth", broker: "Charles Schwab", baseCurrency: "USD")

        profiles = [
            PortfolioProfile(
                id: "personal",
                name: "Personal",
                accounts: [hk, us],
                holdings: [
                    Holding(accountID: hk.id, symbol: "2800.HK", name: "Tracker Fund of Hong Kong", quantity: 800, averageCost: 18.20, currentPrice: 19.46, currency: "HKD"),
                    Holding(accountID: us.id, symbol: "VOO", name: "Vanguard S&P 500 ETF", quantity: 12, averageCost: 428.00, currentPrice: 471.20, currency: "USD")
                ]
            ),
            PortfolioProfile(id: "official", name: "Official", accounts: [], holdings: [])
        ]
        selectedProfileID = "personal"
    }

    private static let defaultProfiles = [
        PortfolioProfile(id: "personal", name: "Personal", accounts: [], holdings: []),
        PortfolioProfile(id: "official", name: "Official", accounts: [], holdings: [])
    ]

    private func mutateSelectedProfile(_ update: (inout PortfolioProfile) -> Void) {
        guard let index = profiles.firstIndex(where: { $0.id == selectedProfileID }) else { return }
        update(&profiles[index])
    }

    private func removeElements<T>(from array: inout [T], at offsets: IndexSet) {
        for index in offsets.sorted(by: >) {
            array.remove(at: index)
        }
    }
}
