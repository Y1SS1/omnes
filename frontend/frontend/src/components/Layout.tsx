import { useEffect, useRef, useState } from "react";
import { ChartLine, House, Menu, Users, Wallet, X, type LucideIcon } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "./Logo";
import { Avatar } from "./ui";

// `alsoActiveOn` keeps a tab highlighted on its detail pages, which live under another path.
type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; alsoActiveOn?: string };

const navItems: NavItem[] = [
  { to: "/", label: "Inicio", icon: House, end: true, alsoActiveOn: "/presupuestos/" },
  { to: "/wallet", label: "Billetera", icon: Wallet },
  { to: "/reports", label: "Reportes", icon: ChartLine },
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const userMenuBtnRef = useRef<HTMLButtonElement>(null);
  const userMenuPanelRef = useRef<HTMLDivElement>(null);

  const items = isAdmin ? [...navItems, { to: "/trabajadores", label: "Trabajadores", icon: Users }] : navItems;

  // Close any open menus whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
    setShowUserMenu(false);
  }, [location.pathname]);

  // Close the user dropdown on an outside click, like any other app - only
  // wiring the listener up while it is actually open.
  useEffect(() => {
    if (!showUserMenu) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !userMenuBtnRef.current?.contains(target) &&
        !userMenuPanelRef.current?.contains(target)
      ) {
        setShowUserMenu(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showUserMenu]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isItemActive = (item: NavItem, isActive: boolean) =>
    isActive || (item.alsoActiveOn !== undefined && location.pathname.startsWith(item.alsoActiveOn));

  const pillClass = (item: NavItem) => ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
      isItemActive(item, isActive) ? "bg-brand text-on-brand" : "text-on-night-muted hover:bg-white/10 hover:text-white"
    }`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-night text-on-night px-4 md:px-6 relative">
        <div className="h-16 flex items-center gap-4">
          <Link to="/" aria-label="Omnes, ir al inicio" className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
            <Logo width={28} height={28} core="#f8f8f8" side="#f8f8f8" />
            <span className="font-display text-xl font-extrabold tracking-tight hidden sm:inline">Omnes</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 overflow-x-auto flex-1 min-w-0 ml-10">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={pillClass(item)}>
                <item.icon size={16} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => setMenuOpen((s) => !s)}
            className="md:hidden ml-auto rounded-full p-2 text-on-night-muted hover:bg-white/10 hover:text-white"
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
          </div>
        </div>

        {/* Mobile nav menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 flex flex-col gap-1 motion-safe:animate-panel-in">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-full px-3 py-2 text-sm font-semibold ${
                    isItemActive(item, isActive) ? "bg-brand text-on-brand" : "text-on-night-muted hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <item.icon size={18} aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
            <div className="flex items-center justify-between px-3 pt-3 mt-2 border-t border-white/15 text-sm">
              <span className="flex items-center gap-2 text-on-night-muted truncate">
                {user && <Avatar name={user.displayName} id={user.userId} size={24} />}
                {user?.displayName}
              </span>
              <button onClick={handleLogout} className="text-on-night-muted hover:text-white text-xs">
                Cerrar sesión
              </button>
            </div>
          </div>
        )}

        {showUserMenu && user && (
          <div
            ref={userMenuPanelRef}
            className="hidden md:block absolute right-6 top-16 w-64 bg-paper text-ink border border-hairline rounded-[18px] shadow-xl z-20 p-3 origin-top-right motion-safe:animate-pop-in"
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

      </header>

      <main className="flex-1 p-4 md:p-6 bg-canvas overflow-x-hidden">
        {/* Keyed by path so each screen plays its entrance; query changes (a filter) do not. */}
        <div key={location.pathname} className="motion-safe:animate-page-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
