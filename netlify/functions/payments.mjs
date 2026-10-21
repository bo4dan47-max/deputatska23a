import { getStore } from "@netlify/blobs";

const TOTAL_APTS = 184; // кількість квартир (має збігатися з index.html)

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const store = getStore("payments");
  const url = new URL(req.url);
  const cur = (await store.get("state", { type: "json" })) || { pay: {}, upd: "", log: [] };

  if (url.pathname === "/api/state" && req.method === "GET") {
    return json({ pay: cur.pay, upd: cur.upd });
  }

  if (url.pathname === "/api/pay" && req.method === "POST") {
    let b;
    try { b = await req.json(); } catch { return json({ error: "Некоректний запит" }, 400); }

    const pass = Netlify.env.get("ADMIN_PASSWORD");
    if (!pass || typeof b.password !== "string" || b.password !== pass) {
      return json({ error: "Невірний пароль" }, 401);
    }
    if (b.check) return json({ ok: true });

    const apt = Number(b.apt);
    const amount = Number(b.amount);
    if (!Number.isInteger(apt) || apt < 1 || apt > TOTAL_APTS) return json({ error: "Невірний номер квартири" }, 400);
    if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) return json({ error: "Невірна сума" }, 400);

    const prev = cur.pay[apt] || 0;
    const next = b.replace ? amount : prev + amount;
    if (next > 0) cur.pay[apt] = next; else delete cur.pay[apt];
    cur.upd = new Date().toISOString();
    cur.log = [...(cur.log || []), { t: cur.upd, apt, amount, replace: !!b.replace, prev }].slice(-500);
    await store.setJSON("state", cur);
    return json({ pay: cur.pay, upd: cur.upd });
  }

  return json({ error: "Not found" }, 404);
};

export const config = { path: ["/api/state", "/api/pay"] };
