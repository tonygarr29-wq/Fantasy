import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

export default function CreateLeagueDialog({ onCreated, triggerLabel }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sport, setSport] = useState("NFL");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await base44.entities.League.create({
        name, sport, description,
        invite_code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      });
      setName(""); setDescription(""); setSport("NFL");
      setOpen(false);
      onCreated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerLabel ? "default" : "outline"} size="sm">
          <Plus className="w-4 h-4 mr-1" /> {triggerLabel || "Create League"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a league</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lname">League name</Label>
            <Input id="lname" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Sunday Squad" />
          </div>
          <div className="space-y-2">
            <Label>Sport</Label>
            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["NFL", "NBA", "MLB", "NHL", "Soccer"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ldesc">Description</Label>
            <Input id="ldesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="The crew, $20 buy-in" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create league"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}