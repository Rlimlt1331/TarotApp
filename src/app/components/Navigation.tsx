import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useTarot } from '../context/TarotContext';
import { useAuth } from '../context/AuthContext';
import { Sparkles, User, BookOpen, Eye, LogOut, LogIn } from 'lucide-react';
import { useState } from 'react';
import { AuthModal } from './AuthModal';
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
  const { requests } = useTarot();
  const { user, logout, isAdmin } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  const navItems = isAdmin
    ? [{ path: '/reader', label: 'Reader Portal', icon: Eye, badge: pendingCount }]
    : [
        { path: '/request', label: 'Request Reading', icon: Sparkles },
        ...(user ? [{ path: '/my-readings', label: 'My Readings', icon: BookOpen }] : []),
      ];
  const homePath = isAdmin ? '/reader' : '/request';

  return (
    <>
      <nav className="nav-blur sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to={homePath} className="flex items-center gap-2 group">
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
              {user ? (
                <>
                  <Badge variant="outline" className="hidden sm:flex">
                    {user.name}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <User className="size-4" />
                        <span className="hidden sm:inline">{user.email}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {user.role === 'requester' && (
                        <DropdownMenuItem onClick={onEditProfile}>
                          Edit Profile
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout} className="text-red-600">
                        <LogOut className="size-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button
                  onClick={() => setAuthModalOpen(true)}
                  size="sm"
                  className="gap-2"
                >
                  <LogIn className="size-4" />
                  Login
                </Button>
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

      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </>
  );
}
