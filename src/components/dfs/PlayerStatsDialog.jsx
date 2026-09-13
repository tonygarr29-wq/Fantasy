import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export default function PlayerStatsDialog({ player, onClose }) {
  return (
    <Dialog open={!!player} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {player?.name}
            <Badge variant="outline">{player?.position}</Badge>
          </DialogTitle>
          <DialogDescription>
            {player?.team} · Salary ${(player?.salary || 0).toLocaleString()}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Fantasy points
            </div>
            <div className="text-2xl font-bold mt-1">
              {(player?.actual_points || 0).toFixed(1)}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Projected points
            </div>
            <div className="text-2xl font-bold mt-1">
              {(player?.projected_points || 0).toFixed(1)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}