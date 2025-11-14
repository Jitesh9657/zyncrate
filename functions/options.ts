// zyncrate/functions/options.ts
export async function onRequest() {
  return new Response(JSON.stringify({
    expiries: [1, 6, 12, 24],
    downloadLimits: [0, 1, 3, 5]
  }), { headers: { "Content-Type": "application/json" }});
}
