import React, { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Trophy } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const navItem = ({ isActive }) =>
  `text-sm font-medium transition-colors ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`;

export default function AppHeader() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    base44.auth.isAuthenticated().then(setAuthed).catch(() => setAuthed(false));
  }, []);

  const logout = async () => {
    await base44.auth.logout();
  };

  return (
    <header className="border-b bg-card/70 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <Trophy className="w-5 h-5 text-primary" />
          Gridiron
        </Link>
        <div className="flex items-center gap-5">
          <nav className="flex items-center gap-5">
            <NavLink to="/" end className={navItem}>Home</NavLink>
            <NavLink to="/players" className={navItem}>Players</NavLink>
          </nav>
          <div className="flex items-center gap-2">
            {authed === null ? null : authed ? (
              <Button size="sm" variant="outline" onClick={logout}>Log out</Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/login">Log in</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}