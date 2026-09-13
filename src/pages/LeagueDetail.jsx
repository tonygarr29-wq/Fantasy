import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppHeader from "@/components/dfs/AppHeader";
import CreateContestDialog from "@/components/dfs/CreateContestDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Calendar } from "lucide-react";

const STATUS_VARIANT = { open: "default", locked: "secondary", completed: "outline" };

export default function LeagueDetail() {
  const { id } = useParams();
  const [league, setLeague] = useState(null);
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const lg = await base44.entities.League.get(id);
        const ct = await base44.entities.Contest.filter({ league_id: id }, "-created_date", 50);
        setLeague(lg);
        setContests(ct);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, refreshKey]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center mb-4">
          <ChevronLeft className="w-4 h-4" /> Leagues
        </Link>
        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold tracking-tight">{league.name}</h1>
                  <Badge variant="secondary">{league.sport}</Badge>
                </div>
                <p className="text-muted-foreground">{league.description || "No description"}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Invite code: <span className="font-mono font-medium">{league.invite_code}</span>
                </p>
              </div>
              <CreateContestDialog leagueId={league.id} sport={league.sport} onCreated={() => setRefreshKey((k) => k + 1)} />
            </div>

            <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5" /> Contests
            </h2>
            {contests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-10 text-center text-muted-foreground">
                  No contests yet. Create one to start drafting.
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {contests.map((c) => (
                  <Link key={c.id} to={`/contest/${c.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="py-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{c.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Entry ${c.entry_fee} · Prize ${c.prize_pool}
                            {c.contest_date ? ` · ${c.contest_date}` : ""}
                          </div>
                        </div>
                        <Badge variant={STATUS_VARIANT[c.status]} className="capitalize">{c.status}</Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}