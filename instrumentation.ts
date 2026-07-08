export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // On Windows dev machines, Node resolves supabase.co's AAAA record first
    // and only falls back to IPv4 after a long connect timeout (~20s+ per
    // request). Preferring IPv4 up front avoids that stall.
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
