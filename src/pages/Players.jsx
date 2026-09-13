import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import AppHeader from "@/components/dfs/AppHeader";
import PlayerDialog from "@/components/dfs/PlayerDialog";
import PlayerStatsDialog from "@/components/dfs/PlayerStatsDialog";
import SyncNFLDFS from "@/components/dfs/SyncNFLDFS";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

const POS_TABS = ["ALL", "QB", "RB", "WR", "TE", "DEF"];

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posFilter, setPosFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [statsPlayer, setStatsPlayer] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await base44.entities.Player.list("-projected_points", 500);
        setPlayers(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  const filtered = useMemo(() => players.filter((p) => {
    if (posFilter !== "ALL" && p.position !== posFilter) return false;
    const q = search.toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.team || "").toLowerCase().includes(q)) return false;
    return true;
  }), [players, posFilter, search]);

  const remove = async (p) => {
    await base44.entities.Player.delete(p.id);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Player Pool</h1>
            <p className="text-muted-foreground">Manage the athletes available to draft this season.</p>
          </div>
          <Button onClick={() => setEditing({})}><Plus className="w-4 h-4 mr-1" /> Add player</Button>
        </div>

        <SyncNFLDFS onDone={() => setRefreshKey((k) => k + 1)} />

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search players or teams" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Tabs value={posFilter} onValueChange={setPosFilter}>
            <TabsList>
              {POS_TABS.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center text-muted-foreground">No players. Add your first to build the pool.</CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Pos</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="text-right">Proj</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell
                        className="font-medium cursor-pointer hover:text-primary"
                        onClick={() => setStatsPlayer(p)}
                      >
                        {p.name}
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.position}</Badge></TableCell>
                      <TableCell>{p.team}</TableCell>
                      <TableCell className="text-right">${(p.salary || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{(p.projected_points || 0).toFixed(1)}</TableCell>
                      <TableCell className="text-right">{(p.actual_points || 0).toFixed(1)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
      {editing && (
        <PlayerDialog
          player={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setRefreshKey((k) => k + 1); }}
        />
      )}
      <PlayerStatsDialog player={statsPlayer} onClose={() => setStatsPlayer(null)} />
    </div>
  );
}