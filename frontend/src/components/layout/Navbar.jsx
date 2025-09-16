import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  HomeIcon, 
  BuildingOfficeIcon, 
  UserGroupIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  UserIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import Button from '../ui/Button';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    {
      name: 'Dashboard',
      href: user?.role === 'SUPER_ADMIN' ? `/${user?.company?.slug}/manage` : `/${user?.company?.slug}/${user?.department?.slug}`,
      icon: HomeIcon,
      current: location.pathname === `/${user?.company?.slug}/manage` || location.pathname.startsWith(`/${user?.company?.slug}/${user?.department?.slug}`)
    },
    ...(user?.role === 'SUPER_ADMIN' ? [
      {
        name: 'Company',
        href: `/${user?.company?.slug}/manage`,
        icon: BuildingOfficeIcon,
        current: location.pathname === `/${user?.company?.slug}/manage`
      },
      {
        name: 'Activity',
        href: `/activity`,
        icon: ChartBarIcon,
        current: location.pathname.startsWith('/activity')
      }
    ] : []),
    ...(user?.department ? [
      {
        name: 'Notes',
        href: `/${user?.company?.slug}/${user?.department?.slug}/notes`,
        icon: DocumentTextIcon,
        current: location.pathname.includes('/notes')
      },
      {
        name: 'Tasks',
        href: `/${user?.company?.slug}/${user?.department?.slug}/tasks`,
        icon: ClipboardDocumentListIcon,
        current: location.pathname.includes('/tasks')
      },
      {
        name: 'Team',
        href: `/${user?.company?.slug}/${user?.department?.slug}`,
        icon: UserGroupIcon,
        current: location.pathname === `/${user?.company?.slug}/${user?.department?.slug}`
      }
    ] : []),
  ];

  return (
    <nav className="bg-white shadow border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-xl font-bold text-blue-600">
                {user?.company?.name || 'CollabNotes'}
              </Link>
              {user?.role === 'SUPER_ADMIN' && (
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                  Admin
                </span>
              )}
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    item.current
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-700">
              <span>{user?.name}</span>
              <span className="px-2 py-1 text-xs bg-gray-100 rounded-full">
                {user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 
                 user?.role === 'DEPT_ADMIN' ? 'Dept Admin' : 'User'}
              </span>
            </div>
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                <UserIcon className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-gray-400 hover:text-gray-500 p-2"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="h-6 w-6" />
              ) : (
                <Bars3Icon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  item.current
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="flex items-center">
                  <item.icon className="h-5 w-5 mr-3" />
                  {item.name}
                </div>
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-4">
              <div className="text-base font-medium text-gray-800">{user?.name}</div>
              <div className="text-sm text-gray-500">{user?.email}</div>
            </div>
            <div className="mt-3 space-y-1">
              <Link
                to="/profile"
                className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Profile
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;