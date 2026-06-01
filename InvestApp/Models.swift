import Foundation

struct BrokerAccount: Identifiable, Codable, Equatable {
    var id = UUID()
    var name: String
    var broker: String
    var baseCurrency: String
}

struct Holding: Identifiable, Codable, Equatable {
    var id = UUID()
    var accountID: UUID
    var symbol: String
    var name: String
    var quantity: Double
    var averageCost: Double
    var currentPrice: Double
    var currency: String

    var costBasis: Double {
        quantity * averageCost
    }

    var marketValue: Double {
        quantity * currentPrice
    }

    var unrealizedGain: Double {
        marketValue - costBasis
    }

    var unrealizedGainPercent: Double {
        guard costBasis != 0 else { return 0 }
        return unrealizedGain / costBasis
    }
}

struct PortfolioSnapshot: Codable {
    var selectedProfileID: String
    var profiles: [PortfolioProfile]
}

struct LegacyPortfolioSnapshot: Codable {
    var accounts: [BrokerAccount]
    var holdings: [Holding]
}

struct PortfolioProfile: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var accounts: [BrokerAccount]
    var holdings: [Holding]
}

extension NumberFormatter {
    static let investmentCurrency: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    static let investmentPercent: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .percent
        formatter.maximumFractionDigits = 2
        return formatter
    }()
}
