import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";

export default function SyncNFLDFS({ onDone }) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const [date, setDate] = useState(dateStr);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const resp = await base44.functions.invoke("syncNFLDFS", { date, replace });
      setResult(resp.data);
      onDone?.();
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 border-primary/30 bg-primary/5">
      <CardContent className="py-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <Label htmlFor="syncdate">Sync slate date (YYYYMMDD)</Label>
            <Input id="syncdate" value={date} onChange={(e) => setDate(e.target.value)} placeholder="20260910" className="bg-background" />
          </div>
          <label className="flex items-center gap-2 text-sm pb-2.5 cursor-pointer">
            <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="w-4 h-4" />
            Replace existing pool
          </label>
          <Button onClick={run} disabled={busy || !/^\d{8}$/.test(date)}>
            <RefreshCw className={`w-4 h-4 mr-1 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Syncing…" : "Sync from NFL API"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Pulls live DraftKings salaries for the slate on that date into your player pool.
        </p>
        {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
        {result && (
          <div className="mt-3 text-sm text-muted-foreground">
            Synced {result.date}: <span className="font-medium text-foreground">{result.created}</span> created,{" "}
            <span className="font-medium text-foreground">{result.updated}</span> updated (of {result.total} slate players).
          </div>
        )}
      </CardContent>
    </Card>
  );
}