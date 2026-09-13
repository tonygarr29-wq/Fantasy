import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"];
const SPORTS = ["NFL", "NBA", "MLB", "NHL", "Soccer"];

export default function PlayerDialog({ player, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [position, setPosition] = useState("QB");
  const [salary, setSalary] = useState(5000);
  const [proj, setProj] = useState(0);
  const [actual, setActual] = useState(0);
  const [sport, setSport] = useState("NFL");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (player) {
      setName(player.name || "");
      setTeam(player.team || "");
      setPosition(player.position || "QB");
      setSalary(player.salary || 5000);
      setProj(player.projected_points || 0);
      setActual(player.actual_points || 0);
      setSport(player.sport || "NFL");
    }
  }, [player]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        name, team, position,
        salary: Number(salary),
        projected_points: Number(proj),
        actual_points: Number(actual),
        sport,
      };
      if (player?.id) {
        await base44.entities.Player.update(player.id, data);
      } else {
        await base44.entities.Player.create(data);
      }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{player ? "Edit player" : "Add player"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Patrick Mahomes" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Team</Label>
              <Input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="KC" />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Salary</Label>
              <Input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Proj pts</Label>
              <Input type="number" step="0.1" value={proj} onChange={(e) => setProj(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Actual pts</Label>
              <Input type="number" step="0.1" value={actual} onChange={(e) => setActual(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sport</Label>
            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPORTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save player"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}