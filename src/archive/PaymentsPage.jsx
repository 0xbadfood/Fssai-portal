import React from 'react'
import { Download, CreditCard } from 'lucide-react'
import { payments } from '../../lib/mockData.js'

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="mt-1 text-sm text-slate-500">Fee payments and invoices across your FSSAI applications.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3">Reference</th>
              <th className="px-5 py-3">Description</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{p.ref}</td>
                <td className="px-5 py-3.5 text-slate-700">{p.desc}</td>
                <td className="px-5 py-3.5 text-slate-500">{p.date}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-800">{p.amount}</td>
                <td className="px-5 py-3.5">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      p.status === 'Paid' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  {p.status === 'Paid' ? (
                    <button className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                      <Download size={12} /> Receipt
                    </button>
                  ) : (
                    <button className="flex items-center gap-1 text-xs font-semibold text-white bg-blue-600 rounded-lg px-3 py-1.5 hover:bg-blue-700">
                      <CreditCard size={12} /> Pay Now
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
