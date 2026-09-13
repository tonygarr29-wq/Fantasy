import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import AppHeader from "@/components/dfs/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

export default function Home() {
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ct = await base44.entities.Contest.list("-created_date", 50);
        setContests(ct);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openContests = contests.filter((c) => c.status === "open");

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <section className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Your fantasy headquarters</h1>
          <p className="text-muted-foreground mt-2">
            Build lineups, run weekly contests, and settle the score with your friends.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5" /> Open Contests
          </h2>
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : openContests.length === 0 ? (
            <p className="text-muted-foreground">No open contests right now.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {openContests.map((c) => (
                <Link key={c.id} to={`/contest/${c.id}`}>
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Entry ${c.entry_fee} · Prize ${c.prize_pool}
                        </div>
                      </div>
                      <Badge>Open</Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}