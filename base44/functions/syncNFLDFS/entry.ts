import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    let body;
    try { body = await req.json(); } catch { body = {}; }
    const replace = !!body?.replace;

    // Date: explicit YYYYMMDD, or auto-pick next upcoming Sunday for scheduled runs.
    let date = body?.date;
    if (!date) {
      const d = new Date();
      const day = d.getDay(); // 0 Sun ... 6 Sat
      const addDays = (7 - day) % 7 || 7; // next Sunday (today if Sunday -> next week)
      d.setDate(d.getDate() + addDays);
      date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    }
    if (!/^\d{8}$/.test(String(date))) {
      return Response.json({ error: 'date must be YYYYMMDD' }, { status: 400 });
    }

    const apiKey = secrets.get('RAPIDAPI_KEY');
    if (!apiKey) return Response.json({ error: 'RAPIDAPI_KEY not set' }, { status: 500 });

    const url = `https://tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com/getNFLDFS?date=${date}&includeTeamDefense=true`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com',
        'x-rapidapi-key': apiKey,
      },
    });
    if (!res.ok) return Response.json({ error: `Upstream ${res.status}` }, { status: 502 });
    const data = await res.json();

    const slate = data?.body?.draftkings;
    if (!Array.isArray(slate)) return Response.json({ error: 'Unexpected API shape' }, { status: 502 });

    // Normalize + dedupe within slate
    const seen = new Set();
    const normalized = [];
    for (const item of slate) {
      const name = item.longName;
      const team = item.team;
      const position = item.pos;
      const salary = Number(item.salary) || 0;
      if (!name || !position || !team) continue;
      const key = `${name.toLowerCase()}|${(team || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ name, team, position, salary, projected_points: 0, actual_points: 0, sport: 'NFL' });
    }

    if (replace) {
      await base44.asServiceRole.entities.Player.deleteMany({ sport: 'NFL' });
      const created = await base44.asServiceRole.entities.Player.bulkCreate(normalized);
      return Response.json({ created: created.length, updated: 0, total: normalized.length, date });
    }

    const existing = await base44.asServiceRole.entities.Player.filter({ sport: 'NFL' }, '-created_date', 500);
    const byKey = {};
    for (const p of existing) byKey[`${(p.name || '').toLowerCase()}|${(p.team || '').toLowerCase()}`] = p;

    const toCreate = [];
    const toUpdate = [];
    for (const n of normalized) {
      const key = `${n.name.toLowerCase()}|${(n.team || '').toLowerCase()}`;
      const found = byKey[key];
      if (found) {
        if (found.salary !== n.salary || found.position !== n.position) {
          toUpdate.push({ id: found.id, salary: n.salary, position: n.position });
        }
      } else {
        toCreate.push(n);
      }
    }

    let created = 0, updated = 0;
    if (toCreate.length) {
      const res2 = await base44.asServiceRole.entities.Player.bulkCreate(toCreate);
      created = res2.length;
    }
    if (toUpdate.length) {
      await base44.asServiceRole.entities.Player.bulkUpdate(toUpdate);
      updated = toUpdate.length;
    }

    return Response.json({ created, updated, total: normalized.length, date });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}