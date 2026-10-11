"use client";

import { useState } from "react";
import type { Approval, Project } from "@/lib/types";

type Props = {
  projects: Project[];
  activeProjectId: string;
  approvals: Approval[];
  onSelectProject: (id: string) => void;
  onCreateProject: (input: { name: string; company: string; cwd: string }) => void;
  onResolveApproval: (id: string, status: "approved" | "rejected") => void;
};

export function ProjectBar({
  projects,
  activeProjectId,
  approvals,
  onSelectProject,
  onCreateProject,
  onResolveApproval,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("Baskani Yazılım");
  const [cwd, setCwd] = useState("");
  const pending = approvals.filter((a) => a.status === "pending");

  return (
    <div className="border-b border-[var(--line)] bg-[var(--bg-elevated)]/80 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={activeProjectId}
          onChange={(e) => onSelectProject(e.target.value)}
          className="max-w-[180px] truncate rounded-md border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1 text-xs"
          title="Proje / şirket"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.company} · {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--muted)] hover:text-[var(--text)]"
        >
          + Proje
        </button>
        {pending.length > 0 ? (
          <span className="rounded-full border border-[var(--brand)]/40 bg-[var(--brand-soft)] px-2 py-0.5 text-[10px] text-[var(--brand)]">
            {pending.length} onay bekliyor
          </span>
        ) : null}
      </div>

      {open ? (
        <form
          className="mt-2 space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !cwd.trim()) return;
            onCreateProject({ name: name.trim(), company: company.trim(), cwd: cwd.trim() });
            setName("");
            setCwd("");
            setOpen(false);
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Proje adı"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1 text-xs"
          />
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Şirket"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1 text-xs"
          />
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="Repo yolu (/Users/...)"
            className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-panel)] px-2 py-1 text-xs"
          />
          <button type="submit" className="rounded-md bg-[var(--brand)] px-2 py-1 text-[11px] font-semibold text-[#1a1405]">
            Kaydet
          </button>
        </form>
      ) : null}

      {pending.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {pending.slice(0, 3).map((a) => (
            <div key={a.id} className="rounded-md border border-[var(--line)] bg-[var(--bg-panel)] p-2 text-[11px]">
              <p className="font-medium">{a.reason}</p>
              <p className="mt-0.5 text-[var(--muted)] line-clamp-2">{a.action}</p>
              <div className="mt-1.5 flex gap-1">
                <button
                  type="button"
                  onClick={() => onResolveApproval(a.id, "approved")}
                  className="rounded bg-[var(--accent)]/20 px-2 py-0.5 text-[var(--accent)]"
                >
                  Onayla
                </button>
                <button
                  type="button"
                  onClick={() => onResolveApproval(a.id, "rejected")}
                  className="rounded bg-[var(--danger)]/20 px-2 py-0.5 text-[var(--danger)]"
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
