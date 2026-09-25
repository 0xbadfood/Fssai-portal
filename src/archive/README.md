# Archived screens

Removed from the dashboard (not routed, not bundled). They run on mock data from `src/lib/mockData.js`.

- `AIAssistantPage.jsx`, `AIAssistant.jsx`: scripted demo assistant
- `NoticesPage.jsx`: mock FSSAI notices
- `LicencesPage.jsx`: mock registrations & licences
- `PaymentsPage.jsx`: mock payments
- `DashboardHome.mock.jsx`, `widgets.jsx`: the old mock dashboard (KPIs, charts)

To bring one back, move it into `src/pages/dashboard/`, fix its relative imports, and add its route in `src/App.jsx` and nav entry in `src/components/dashboard/DashboardLayout.jsx`.
