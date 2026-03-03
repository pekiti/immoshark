import { NavLink } from "react-router-dom";

const navigation = [
  { name: "Dashboard", href: "/", icon: "📊" },
  { name: "Immobilien", href: "/immobilien", icon: "🏠" },
  { name: "Neu anlegen", href: "/immobilien/neu", icon: "➕" },
  { name: "CSV Import", href: "/csv-import", icon: "📄" },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const navContent = (
    <nav className="flex flex-1 flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-3 px-3">
        <span className="text-3xl">🦈</span>
        <span className="text-xl font-bold text-white">ImmoShark</span>
      </div>
      {navigation.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.href === "/"}
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-white/15 text-white"
                : "text-gray-300 hover:bg-white/10 hover:text-white"
            }`
          }
        >
          <span className="text-lg">{item.icon}</span>
          {item.name}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-shark">
            {navContent}
          </div>
        </div>
      )}
      {/* Desktop sidebar */}
      <div className="hidden w-64 flex-col bg-shark lg:flex">
        {navContent}
      </div>
    </>
  );
}
