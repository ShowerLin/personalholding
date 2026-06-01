import SwiftUI

@main
struct InvestAppApp: App {
    @StateObject private var store = PortfolioStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
        }
    }
}
