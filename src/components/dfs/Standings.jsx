import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Trophy } from "lucide-react";

export default function Standings({ lineups, playerMap, completed, meId }) {
  const ranked = useMemo(() => {
    const withScores = lineups.map((l) => {
      const total_actual = (l.player_ids || []).reduce(
        (s, pid) => s + (playerMap[pid]?.actual_points || 0),
        0
      ) + (l.captain_id ? (playerMap[l.captain_id]?.actual_points || 0) * 0.5 : 0);
      return { ...l, total_actual };
    });
    const sortKey = completed ? "total_actual" : "total_projected";
    return [...withScores].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  }, [lineups, playerMap, completed]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" /> Standings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ranked.length === 0 ? (
          <p className="text-muted-foreground text-sm">No lineups yet. Be the first to draft.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead className="text-right">Proj</TableHead>
                {completed && <TableHead className="text-right">Actual</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.map((l, i) => (
                <TableRow key={l.id} className={l.created_by_id === meId ? "bg-muted/50" : ""}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>
                    {l.created_by_id === meId
                      ? "You"
                      : `Player · ${(l.created_by_id || "").slice(-4)}`}
                  </TableCell>
                  <TableCell className="text-right">{(l.total_projected || 0).toFixed(1)}</TableCell>
                  {completed && (
                    <TableCell className="text-right font-semibold">
                      {(l.total_actual || 0).toFixed(1)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}