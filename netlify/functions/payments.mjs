import { getStore } from "@netlify/blobs";

const TOTAL_APTS = 175; // найбільший номер квартири (має збігатися з index.html)
const ALIAS = { 170: 169 }; // кв. 169/170 — одна квартира, внески йдуть на 169

// Початкові внески (завантажуються один раз при першому запуску)
const SEED = {"2":400,"3":600,"5":500,"6":500,"11":700,"16":400,"17":500,"18":1000,"24":1000,"34":500,"43":350,"47":1000,"48":1000,"49":1000,"51":1000,"55":1000,"56":1000,"61":500,"62":700,"66":500,"70":500,"74":1000,"76":500,"81":1000,"82":1350,"83":500,"89":1000,"97":1000,"98":500,"100":1000,"102":1000,"105":500,"106":500,"107":555,"114":1000,"123":500,"124":1000,"126":1000,"131":1000,"132":1000,"137":1000,"138":1000,"139":1000,"145":1000,"146":1000,"148":500,"149":2000,"152":1000,"156":1000,"163":1000,"164":1000,"167":500,"169":1000,"172":1000,"173":1000};

async function load(store) {
  let cur = await store.get("state", { type: "json" });
  if (!cur || !cur.seeded) {
    cur = { pay: { ...SEED }, upd: new Date().toISOString(), log: (cur && cur.log) || [], seeded: true };
    await store.setJSON("state", cur);
  }
  return cur;
}

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export default async (req) => {
  const store = getStore("payments");
  const url = new URL(req.url);
  const cur = await load(store);

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

    const apt = ALIAS[Number(b.apt)] || Number(b.apt);
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
