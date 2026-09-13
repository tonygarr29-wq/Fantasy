import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlayerStatsDialog from "@/components/dfs/PlayerStatsDialog";
import { Save, X, Search, Crown } from "lucide-react";

const ROSTER = [
  { key: "QB", label: "QB", positions: ["QB"] },
  { key: "RB1", label: "RB", positions: ["RB"] },
  { key: "RB2", label: "RB", positions: ["RB"] },
  { key: "WR1", label: "WR", positions: ["WR"] },
  { key: "WR2", label: "WR", positions: ["WR"] },
  { key: "TE", label: "TE", positions: ["TE"] },
  { key: "FLEX", label: "FLEX", positions: ["RB", "WR", "TE"] },
  { key: "DEF", label: "DEF", positions: ["DEF"] },
];

const POS_TABS = ["ALL", "QB", "RB", "WR", "TE", "DEF"];

export default function LineupBuilder({ contest, players, playerMap, existing, onSaved }) {
  const [slots, setSlots] = useState(() =>
    ROSTER.map((slot, i) => ({ ...slot, playerId: existing?.player_ids?.[i] ?? null }))
  );
  const [posFilter, setPosFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [statsPlayer, setStatsPlayer] = useState(null);
  const [captainId, setCaptainId] = useState(existing?.captain_id ?? null);

  const selectedIds = slots.map((s) => s.playerId).filter(Boolean);
  const usedSalary = slots.reduce(
    (sum, s) => sum + (s.playerId ? playerMap[s.playerId]?.salary || 0 : 0),
    0
  );
  const remaining = contest.salary_cap - usedSalary;
  const captainBonus = captainId ? (playerMap[captainId]?.projected_points || 0) * 0.5 : 0;
  const projected = slots.reduce(
    (sum, s) => sum + (s.playerId ? playerMap[s.playerId]?.projected_points || 0 : 0),
    0
  ) + (contest.captain_mode ? captainBonus : 0);
  const filled = slots.filter((s) => s.playerId).length;
  const complete = filled === ROSTER.length && remaining >= 0;

  const addPlayer = (player) => {
    if (selectedIds.includes(player.id)) return;
    if (usedSalary + player.salary > contest.salary_cap) return;
    setSlots((prev) => {
      const idx = prev.findIndex((s) => !s.playerId && s.positions.includes(player.position));
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], playerId: player.id };
      return next;
    });
  };

  const removeSlot = (idx) => {
    setSlots((prev) => {
      const next = [...prev];
      if (captainId === next[idx].playerId) setCaptainId(null);
      next[idx] = { ...next[idx], playerId: null };
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const player_ids = slots.map((s) => s.playerId).filter(Boolean);
      const total_projected = slots.reduce(
        (sum, s) => sum + (s.playerId ? playerMap[s.playerId]?.projected_points || 0 : 0),
        0
      ) + (contest.captain_mode ? captainBonus : 0);
      const captain_id = contest.captain_mode ? captainId : null;
      if (existing?.id) {
        await base44.entities.Lineup.update(existing.id, { player_ids, total_projected, captain_id });
      } else {
        await base44.entities.Lineup.create({ contest_id: contest.id, player_ids, total_projected, captain_id });
      }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return players
      .filter((p) => {
        if (posFilter !== "ALL" && p.position !== posFilter) return false;
        const q = search.toLowerCase();
        if (q && !p.name.toLowerCase().includes(q) && !(p.team || "").toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => b.projected_points - a.projected_points);
  }, [players, posFilter, search]);

  const salaryPct = Math.min(100, (usedSalary / contest.salary_cap) * 100);
  const overCap = remaining < 0;

  return (
    <div className="grid lg:grid-cols-2 gap-6 mb-8">
      {/* Roster */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Your Lineup</span>
            <Badge variant={complete ? "default" : "secondary"}>
              {filled}/{ROSTER.length} filled
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Salary bar */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Salary used</span>
              <span className={overCap ? "text-destructive font-medium" : ""}>
                ${usedSalary.toLocaleString()} / ${contest.salary_cap.toLocaleString()}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={overCap ? "h-full bg-destructive" : "h-full bg-primary transition-all"}
                style={{ width: `${salaryPct}%` }}
              />
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-muted-foreground">Remaining: ${remaining.toLocaleString()}</span>
              <span className="font-medium">Proj: {projected.toFixed(1)}</span>
            </div>
          </div>

          {/* Slots */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {slots.map((s, i) => {
              const p = s.playerId ? playerMap[s.playerId] : null;
              return (
                <button
                  key={s.key}
                  onClick={() => p && removeSlot(i)}
                  className={`text-left rounded-lg border p-2 min-h-[84px] transition-colors ${
                    p ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : "border-dashed border-border"
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide flex items-center justify-between">
                    <span>{s.label}</span>
                    {p && contest.captain_mode && (
                      <span
                        role="button"
                        title="Captain — points count 1.5x"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCaptainId(captainId === p.id ? null : p.id);
                        }}
                        className={captainId === p.id ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}
                      >
                        <Crown className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  {p ? (
                    <div className="mt-1">
                      <div className="text-sm font-medium leading-tight flex items-center justify-between">
                        <span className="truncate">{p.name}</span>
                        <X className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      </div>
                      <div className="text-xs text-muted-foreground">{p.team} · ${p.salary.toLocaleString()}</div>
                      <div className="text-xs font-medium mt-0.5">{p.projected_points.toFixed(1)} pts</div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1">Empty</div>
                  )}
                </button>
              );
            })}
          </div>

          <Button onClick={save} disabled={!complete || saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving…" : existing?.id ? "Update lineup" : "Submit lineup"}
          </Button>
          {contest.captain_mode && (
            <p className="text-xs text-muted-foreground text-center">
              Tap the crown on a player to make them your captain — their points count 1.5x.
            </p>
          )}
          {!complete && (
            <p className="text-xs text-muted-foreground text-center">
              Fill all {ROSTER.length} roster spots to submit.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Player pool */}
      <Card>
        <CardHeader>
          <CardTitle>Player Pool</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players or teams"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={posFilter} onValueChange={setPosFilter}>
            <TabsList className="w-full justify-start overflow-x-auto">
              {POS_TABS.map((t) => (
                <TabsTrigger key={t} value={t}>{t}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="max-h-[420px] overflow-y-auto rounded-lg border divide-y">
            {filtered.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              const hasSlot = slots.some((s) => !s.playerId && s.positions.includes(p.position));
              const canAfford = usedSalary + p.salary <= contest.salary_cap;
              const disabled = isSelected || !hasSlot || !canAfford;
              return (
                <div key={p.id} className="flex items-center justify-between p-2.5 gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                        onClick={() => setStatsPlayer(p)}
                      >
                        {p.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{p.position}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.team} · ${p.salary.toLocaleString()} · {p.projected_points.toFixed(1)} pts
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isSelected ? "secondary" : "outline"}
                    disabled={disabled}
                    onClick={() => addPlayer(p)}
                  >
                    {isSelected ? "Added" : "Add"}
                  </Button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">No players found.</div>
            )}
          </div>
        </CardContent>
      </Card>
      <PlayerStatsDialog player={statsPlayer} onClose={() => setStatsPlayer(null)} />
    </div>
  );
}