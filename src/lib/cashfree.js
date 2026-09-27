// Cashfree's checkout: load their SDK on demand and send the browser to their payment page. The server creates
// the order and gives us its payment session; the customer comes back to /dashboard/payment/return.
const SDK = 'https://sdk.cashfree.com/js/v3/cashfree.js'

let loading = null
function loadSdk() {
  loading ??= new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve(window.Cashfree)
    const s = document.createElement('script')
    s.src = SDK
    s.async = true
    s.onload = () => (window.Cashfree ? resolve(window.Cashfree) : reject(new Error('Payment page did not load')))
    s.onerror = () => {
      loading = null
      reject(new Error('Could not reach the payment gateway. Check your connection and try again.'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/** Open the gateway's checkout in this tab. `mode`: 'sandbox' | 'live' (from the server). */
export async function openCheckout(sessionId, mode) {
  const Cashfree = await loadSdk()
  const cf = Cashfree({ mode: mode === 'live' ? 'production' : 'sandbox' })
  const out = await cf.checkout({ paymentSessionId: sessionId, redirectTarget: '_self' })
  if (out?.error) throw new Error(out.error.message || 'The payment could not be started.')
}
