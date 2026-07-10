"use client";

import { useEffect, useState } from "react";
import {
  BellRing,
  ChartNoAxesCombined,
  FileText,
  LogOut,
  Menu,
  MessageSquareText,
  X,
} from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
}

const navItems = [
  { icon: ChartNoAxesCombined, label: "Ringkasan", href: "#ringkasan" },
  { icon: FileText, label: "Performa post", href: "#posts" },
  { icon: MessageSquareText, label: "Komentar", href: "#komentar" },
  { icon: BellRing, label: "Alert Markom", href: "#alerts" },
];

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeHref, setActiveHref] = useState("#ringkasan");

  useEffect(() => {
    const sections = navItems
      .map((item) => document.querySelector(item.href))
      .filter((section): section is Element => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveHref(`#${visible.target.id}`);
      },
      { rootMargin: "-18% 0px -68%", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Lewati ke konten</a>

      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Tutup navigasi"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-monogram" aria-hidden="true">BK</div>
          <div>
            <strong>Beauty Kendari</strong>
            <span>sentiment desk</span>
          </div>
          <button
            className="icon-button sidebar-close"
            type="button"
            aria-label="Tutup navigasi"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navigasi dashboard">
          <span className="nav-label">Monitor</span>
          {navItems.map((item, index) => (
            <a
              key={item.href}
              href={item.href}
              className={activeHref === item.href ? "active" : ""}
              onClick={() => {
                setActiveHref(item.href);
                setSidebarOpen(false);
              }}
            >
              <item.icon size={18} strokeWidth={1.7} />
              <span>{item.label}</span>
              <small>0{index + 1}</small>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="system-status">
            <span className="status-dot" />
            <div>
              <strong>Monitoring aktif</strong>
              <span>Polling setiap 15–30 menit</span>
            </div>
          </div>
          <button className="logout-button" type="button" onClick={logout}>
            <LogOut size={17} />
            Keluar
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="mobile-header">
          <button
            className="icon-button"
            type="button"
            aria-label="Buka navigasi"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div>
            <strong>Beauty Kendari</strong>
            <span>sentiment desk</span>
          </div>
          <span className="status-dot" aria-label="Monitoring aktif" />
        </header>
        <main id="main-content" className="main-content">{children}</main>
      </div>
    </div>
  );
}
