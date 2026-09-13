import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

export default function CreateContestDialog({ leagueId, sport, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState(20);
  const [prizePool, setPrizePool] = useState(0);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.Contest.create({
        league_id: leagueId,
        name,
        sport,
        status: "open",
        entry_fee: Number(entryFee),
        prize_pool: Number(prizePool),
        salary_cap: 50000,
        contest_date: date || undefined,
      });
      setName(""); setEntryFee(20); setPrizePool(0); setDate("");
      setOpen(false);
      onCreated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Contest</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a contest</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cname">Contest name</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Week 1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ef">Entry fee ($)</Label>
              <Input id="ef" type="number" min="0" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp">Prize pool ($)</Label>
              <Input id="pp" type="number" min="0" value={prizePool} onChange={(e) => setPrizePool(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cd">Contest date</Label>
            <Input id="cd" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create contest"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}