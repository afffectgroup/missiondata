// pages/api/debug/icypeas.js — temporary debug route
import { requireAuth } from '../../../lib/auth';

export default async function handler(req, res) {
  try { await requireAuth(req); } catch(e) { return res.status(401).json({ error: e.message }); }
  
  const { search_id } = req.body;
  const KEY = process.env.ICYPEAS_API_KEY;
  
  const r = await fetch('https://app.icypeas.com/api/bulk-single-searchs/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': KEY },
    body: JSON.stringify({ id: search_id }),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch(e) { json = null; }
  
  return res.status(200).json({ raw: text.slice(0, 2000), parsed: json, status: r.status });
}
