import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { Activity, BarChart3, Heart, Search, Users } from 'lucide-react';

const links = [
  { to: '/', label: 'System Health', icon: Heart },
  { to: '/api', label: 'API Analytics', icon: BarChart3 },
  { to: '/business', label: 'Business', icon: Activity },
  { to: '/activity', label: 'User Activity', icon: Users },
  { to: '/trace', label: 'Request Trace', icon: Search },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 flex h-screen w-56 flex-col border-r border-zinc-800 bg-zinc-950 px-3 py-4">
      <div className="mb-6 px-2">
        <h1 className="text-lg font-bold text-zinc-100">Monitoring</h1>
        <p className="text-xs text-zinc-500">Betacom Shopee</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors cursor-pointer',
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
