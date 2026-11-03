import { useEffect, useRef, useState } from "react";
import { Bell, ChartLine, FileSpreadsheet, House, Menu, Users, Wallet, X, type LucideIcon } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";
import { Avatar } from "./ui";
import * as notificationsApi from "../api/notifications";
import type { NotificationDto } from "../api/types";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };

const navItems: NavItem[] = [
  { to: "/", label: "Inicio", icon: House, end: true },
  { to: "/wallet", label: "Billetera", icon: Wallet },
  { to: "/presupuestos", label: "Presupuestos", icon: FileSpreadsheet },
  { to: "/reports", label: "Reportes", icon: ChartLine },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const userMenuBtnRef = useRef<HTMLButtonElement>(null);
  const userMenuPanelRef = useRef<HTMLDivElement>(null);
  const notifBtnDesktopRef = useRef<HTMLButtonElement>(null);
  const notifBtnMobileRef = useRef<HTMLButtonElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  const items = isAdmin ? [...navItems, { to: "/trabajadores", label: "Trabajadores", icon: Users }] : navItems;

  const loadNotifications = async () => {
    try {
      setNotifications(await notificationsApi.getNotifications());
    } catch {
      // ignore transient failures
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 20000);
    return () => clearInterval(interval);
  }, []);

  // Close any open menus whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setShowUserMenu(false);
    setShowNotifications(false);
  }, [location.pathname]);

  // Close the user/notifications dropdowns on an outside click, like any
  // other app - only wiring the listener up while one is actually open.
  useEffect(() => {
    if (!showUserMenu && !showNotifications) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        showUserMenu &&
        !userMenuBtnRef.current?.contains(target) &&
        !userMenuPanelRef.current?.contains(target)
      ) {
        setShowUserMenu(false);
      }
      if (
        showNotifications &&
        !notifBtnDesktopRef.current?.contains(target) &&
        !notifBtnMobileRef.current?.contains(target) &&
        !notifPanelRef.current?.contains(target)
      ) {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showUserMenu, showNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const pillClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      isActive ? "bg-highlight text-ink" : "text-[#c9c7f0] hover:bg-white/10 hover:text-white"
    }`;

  const unreadBadge = unreadCount > 0 && (
    <span className="absolute -top-0.5 -right-0.5 bg-tangerine text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
      {unreadCount}
    </span>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-ink text-white px-4 md:px-6 relative">
        <div className="h-16 flex items-center gap-4">
          <Link to="/" aria-label="Omnes, ir al inicio" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
            <Logo width={28} height={28} core="#ffffff" />
            <span className="font-display text-xl font-extrabold tracking-tight hidden sm:inline">Omnes</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 overflow-x-auto flex-1 min-w-0 ml-10">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={pillClass}>
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setMenuOpen((s) => !s)}
            className="md:hidden ml-auto rounded-full p-2 text-[#c9c7f0] hover:bg-white/10 hover:text-white"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>

          <div className="hidden md:flex items-center gap-2 ml-auto shrink-0">
            {user && (
              <button ref={userMenuBtnRef} onClick={() => setShowUserMenu((s) => !s)} aria-label="Cuenta" className="rounded-full ring-2 ring-white/20 hover:ring-highlight">
                <Avatar name={user.displayName} id={user.userId} size={32} />
              </button>
            )}
            <button
              ref={notifBtnDesktopRef}
              onClick={() => setShowNotifications((s) => !s)}
              className="relative rounded-full p-2 text-[#c9c7f0] hover:bg-white/10 hover:text-white"
              aria-label="Notificaciones"
            >
              <Bell size={20} aria-hidden="true" />
              {unreadBadge}
            </button>
          </div>

          <button
            ref={notifBtnMobileRef}
            onClick={() => setShowNotifications((s) => !s)}
            className="md:hidden relative rounded-full p-2 text-[#c9c7f0] hover:bg-white/10 hover:text-white"
            aria-label="Notificaciones"
          >
            <Bell size={20} aria-hidden="true" />
            {unreadBadge}
          </button>
        </div>

        {/* Mobile nav menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-full px-3 py-2 text-sm font-semibold ${
                    isActive ? "bg-highlight text-ink" : "text-[#c9c7f0] hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <item.icon size={18} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
            <div className="flex items-center justify-between px-3 pt-3 mt-2 border-t border-white/15 text-sm">
              <span className="flex items-center gap-2 text-[#c9c7f0] truncate">
                {user && <Avatar name={user.displayName} id={user.userId} size={24} />}
                {user?.displayName}
              </span>
              <button onClick={handleLogout} className="text-[#c9c7f0] hover:text-white text-xs">
                Cerrar sesión
              </button>
            </div>
          </div>
        )}

        {showUserMenu && user && (
          <div
            ref={userMenuPanelRef}
            className="hidden md:block absolute right-6 top-16 w-64 bg-paper text-ink border border-hairline rounded-[18px] shadow-xl z-20 p-3"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-hairline">
              <Avatar name={user.displayName} id={user.userId} size={40} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink truncate">{user.displayName}</div>
                <div className="text-xs text-mid-gray truncate">{user.email}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left mt-2 px-1 py-1.5 text-sm text-mid-gray hover:text-ink"
            >
              Cerrar sesión
            </button>
          </div>
        )}

        {showNotifications && (
          <div
            ref={notifPanelRef}
            className="absolute right-4 md:right-6 top-16 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto bg-paper text-ink border border-hairline rounded-[18px] shadow-xl z-20"
          >
            {notifications.length === 0 ? (
              <div className="p-4 text-sm text-mid-gray">Sin notificaciones por ahora.</div>
            ) : (
              <div className="flex justify-end px-3 py-2 border-b border-hairline">
                <button
                  onClick={async () => {
                    await notificationsApi.clearNotifications();
                    loadNotifications();
                  }}
                  className="text-xs text-mid-gray hover:text-ink"
                >
                  Limpiar todas
                </button>
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className="flex items-start gap-2 px-4 py-3 text-sm border-b border-hairline last:border-0 hover:bg-canvas"
              >
                <button
                  onClick={async () => {
                    if (!n.isRead) {
                      await notificationsApi.markNotificationRead(n.id);
                      loadNotifications();
                    }
                  }}
                  className={`flex-1 min-w-0 text-left ${n.isRead ? "text-mid-gray" : "text-ink font-medium"}`}
                >
                  {n.message}
                  <div className="text-[11px] text-mid-gray mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </button>
                <button
                  onClick={async () => {
                    await notificationsApi.deleteNotification(n.id);
                    loadNotifications();
                  }}
                  className="shrink-0 text-mid-gray hover:text-ember"
                  aria-label="Borrar notificación"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </header>

      <main className="flex-1 p-4 md:p-6 bg-canvas overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
