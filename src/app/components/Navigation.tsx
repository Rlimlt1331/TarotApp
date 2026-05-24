import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useTarot } from '../context/TarotContext';
import { Sparkles, User, BookOpen, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function Navigation({ onEditProfile }: { onEditProfile: () => void }) {
  const location = useLocation();
  const { currentUser, isReader, setIsReader, requests } = useTarot();

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const navItems = [
    { path: '/request', label: 'Request Reading', icon: Sparkles },
    { path: '/my-readings', label: 'My Readings', icon: BookOpen },
    { path: '/reader', label: 'Reader Portal', icon: Eye, badge: pendingCount },
  ];

  return (
    <nav className="nav-blur sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              <Sparkles className="size-6 text-primary sparkle" />
              <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-900 bg-clip-text text-transparent">
                Mystic Tarot Portal
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <Link key={item.path} to={item.path}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      className="relative"
                    >
                      <Icon className="size-4 mr-2" />
                      {item.label}
                      {item.badge !== undefined && item.badge > 0 && (
                        <Badge className="ml-2 h-5 px-1 min-w-5 flex items-center justify-center">
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser && (
              <>
                <Badge variant="outline" className="hidden sm:flex">
                  {currentUser.horoscope}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <User className="size-4" />
                      <span className="hidden sm:inline">{currentUser.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onEditProfile}>
                      Edit Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <div className="flex items-center justify-between w-full">
                        <span>Reader Mode</span>
                        <input
                          type="checkbox"
                          checked={isReader}
                          onChange={(e) => setIsReader(e.target.checked)}
                          className="ml-2"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-muted-foreground text-xs">
                      Readings: {currentUser.readingsCount}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        <div className="md:hidden flex items-center gap-2 mt-3 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link key={item.path} to={item.path}>
                <Button
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  className="relative whitespace-nowrap"
                >
                  <Icon className="size-4 mr-2" />
                  {item.label}
                  {item.badge !== undefined && item.badge > 0 && (
                    <Badge className="ml-2 h-5 px-1 min-w-5 flex items-center justify-center">
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
