import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppHeader from "@/components/dfs/AppHeader";
import LineupBuilder from "@/components/dfs/LineupBuilder";
import Standings from "@/components/dfs/Standings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Lock, CheckCircle2, DollarSign } from "lucide-react";

export default function ContestDetail() {
  const { id } = useParams();
  const [contest, setContest] = useState(null);
  const [league, setLeague] = useState(null);
  const [players, setPlayers] = useState([]);
  const [lineups, setLineups] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ct, user] = await Promise.all([
          base44.entities.Contest.get(id),
          base44.auth.me().catch(() => null),
        ]);
        setContest(ct);
        setMe(user);
        const teamFilter = ct.allowed_teams?.length
          ? { $in: ct.allowed_teams.flatMap((t) => [t.toUpperCase(), t.toLowerCase()]) }
          : null;
        const [lg, pls, lns] = await Promise.all([
          base44.entities.League.get(ct.league_id),
          teamFilter
            ? base44.entities.Player.filter({ sport: ct.sport, team: teamFilter }, "-projected_points", 200)
            : base44.entities.Player.filter({ sport: ct.sport }, "-projected_points", 200),
          base44.entities.Lineup.filter({ contest_id: id }, "-total_projected", 100),
        ]);
        setLeague(lg);
        setPlayers(pls);
        setLineups(lns);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, refreshKey]);

  const playerMap = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);
  const myLineup = useMemo(() => lineups.find((l) => l.created_by_id === me?.id), [lineups, me]);

  const setStatus = async (status) => {
    await base44.entities.Contest.update(contest.id, { status });
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-6 py-8 text-muted-foreground">Loading…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link to={league ? `/league/${league.id}` : "/"} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center mb-4">
          <ChevronLeft className="w-4 h-4" /> Back
        </Link>

        <div className="relative overflow-hidden rounded-2xl mb-8 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 shadow-lg">
          {/* glow accents */}
          <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-16 -bottom-16 w-72 h-72 rounded-full bg-emerald-900/30 blur-2xl" />
          {/* field-line texture */}
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: "repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 44px)" }}
          />
          <div className="relative p-6 sm:p-8 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl sm:text-4xl font-bold tracking-tight drop-shadow">{contest.name}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize bg-white/20 text-white border border-white/30 backdrop-blur">
                    {contest.status}
                  </span>
                </div>
                <p className="text-white/80">{league?.name} · {contest.sport}</p>
                {contest.allowed_teams?.length > 0 && (
                  <p className="text-white/70 text-sm mt-0.5">
                    Single-game slate · {contest.allowed_teams.join(" vs ")} players only
                  </p>
                )}
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm">
                  <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> Entry ${contest.entry_fee}</span>
                  <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> Prize ${contest.prize_pool}</span>
                  <span>Cap ${contest.salary_cap.toLocaleString()}</span>
                  <span>{lineups.length} {lineups.length === 1 ? "entry" : "entries"}</span>
                </div>
              </div>
              {contest.status === "open" && (
                <Button
                  size="sm"
                  className="bg-white text-emerald-700 hover:bg-white/90 hover:text-emerald-800"
                  onClick={() => setStatus("locked")}
                >
                  <Lock className="w-4 h-4 mr-1" /> Lock lineups
                </Button>
              )}
              {contest.status === "locked" && (
                <Button
                  size="sm"
                  className="bg-white text-emerald-700 hover:bg-white/90 hover:text-emerald-800"
                  onClick={() => setStatus("completed")}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Finalize scores
                </Button>
              )}
            </div>
          </div>
        </div>

        {contest.status === "open" ? (
          <LineupBuilder
            contest={contest}
            players={players}
            playerMap={playerMap}
            existing={myLineup}
            onSaved={() => setRefreshKey((k) => k + 1)}
          />
        ) : (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{contest.status === "completed" ? "Contest finalized" : "Lineups locked"}</CardTitle>
              <CardDescription>
                {contest.status === "completed"
                  ? "Final scores are in — check the standings below."
                  : "Drafting is closed. Finalize scores when games are done."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myLineup && (
                <div className="text-sm text-muted-foreground">
                  Your lineup is saved with {(myLineup.total_projected || 0).toFixed(1)} projected points.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Standings
          lineups={lineups}
          playerMap={playerMap}
          completed={contest.status === "completed"}
          meId={me?.id}
        />
      </main>
    </div>
  );
}