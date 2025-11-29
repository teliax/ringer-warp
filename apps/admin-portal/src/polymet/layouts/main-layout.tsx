import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Badge } from "@/components/ui/badge";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  LayoutDashboardIcon,
  PhoneIcon,
  HashIcon,
  MessageSquareIcon,
  DatabaseIcon,
  FileTextIcon,
  CreditCardIcon,
  HeadphonesIcon,
  SettingsIcon,
  SearchIcon,
  BellIcon,
  MenuIcon,
  XIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UserIcon,
  LogOutIcon,
  HelpCircleIcon,
  UsersIcon,
  KeyIcon,
  BuildingIcon,
  TruckIcon,
  DollarSignIcon,
  PackageIcon,
  TicketIcon,
  BarChart3Icon,
  ExternalLinkIcon,
  ServerIcon,
  MailIcon,
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboardIcon,
    description: "Admin overview & analytics",
  },
  {
    name: "Customers",
    href: "/customers",
    icon: UsersIcon,
    description: "Customer management & search",
  },
  {
    name: "Vendors",
    href: "/vendors",
    icon: TruckIcon,
    description: "Voice, messaging & data vendors",
  },
  {
    name: "Accounting",
    href: "/accounting",
    icon: DollarSignIcon,
    description: "Credits, limits & transactions",
  },
  {
    name: "ERP Management",
    href: "/erp-management",
    icon: PackageIcon,
    description: "SKUs, packages & pricing",
  },
  {
    name: "Support",
    href: "/support",
    icon: HeadphonesIcon,
    hasSubmenu: true,
    submenu: [
      {
        name: "Tickets",
        href: "https://support.ringer.tel/a/dashboard/default",
        icon: TicketIcon,
        description: "Support ticket system",
        external: true,
      },
      {
        name: "Search",
        href: "/support-search",
        icon: SearchIcon,
        description: "CDR, messages & telco data",
      },
      {
        name: "Analysis",
        href: "/support-analysis",
        icon: BarChart3Icon,
        description: "Call flows, KYC & messaging analysis",
      },
    ],
  },
];

export function MainLayout({ children, title }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSubmenu = (itemName: string) => {
    setExpandedMenus((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isSubmenuExpanded = (itemName: string) =>
    expandedMenus.includes(itemName);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-[#231F20] transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-gray-700">
          <div className="flex items-center justify-start">
            <img
              src="https://assets.polymet.ai/stingy-beige-136926"
              alt="Ringer"
              className="h-8 w-auto"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <XIcon className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const isSubmenuActive = item.submenu?.some(
              (subItem) => location.pathname === subItem.href
            );
            const shouldExpand =
              isSubmenuActive || isSubmenuExpanded(item.name);

            return (
              <div key={item.name}>
                {item.hasSubmenu ? (
                  <>
                    <div className="flex items-center">
                      <Link
                        to={item.href}
                        className={cn(
                          "group flex items-center flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                          isActive || isSubmenuActive
                            ? "bg-[#58C5C7] text-white"
                            : "text-gray-300 hover:bg-gray-700 hover:text-white"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "mr-3 h-5 w-5 flex-shrink-0",
                            isActive || isSubmenuActive
                              ? "text-white"
                              : "text-gray-400 group-hover:text-white"
                          )}
                        />

                        {item.name}
                      </Link>
                      <button
                        onClick={() => toggleSubmenu(item.name)}
                        className={cn(
                          "p-2 rounded-md transition-colors",
                          isActive || isSubmenuActive
                            ? "text-white hover:bg-[#58C5C7]/80"
                            : "text-gray-400 hover:bg-gray-700 hover:text-white"
                        )}
                      >
                        <ChevronRightIcon
                          className={cn(
                            "h-4 w-4 transition-transform",
                            shouldExpand ? "rotate-90" : ""
                          )}
                        />
                      </button>
                    </div>
                    {shouldExpand && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.submenu?.map((subItem) => {
                          const isSubActive =
                            location.pathname === subItem.href;

                          if (subItem.external) {
                            return (
                              <a
                                key={subItem.name}
                                href={subItem.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center px-3 py-2 text-sm rounded-md transition-colors text-gray-400 hover:bg-gray-700 hover:text-white"
                              >
                                <subItem.icon className="mr-3 h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-white" />

                                {subItem.name}
                                <ExternalLinkIcon className="ml-auto h-3 w-3 text-gray-400 group-hover:text-white" />
                              </a>
                            );
                          }

                          return (
                            <Link
                              key={subItem.name}
                              to={subItem.href}
                              className={cn(
                                "group flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                                isSubActive
                                  ? "bg-[#58C5C7] text-white"
                                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
                              )}
                            >
                              <subItem.icon
                                className={cn(
                                  "mr-3 h-4 w-4 flex-shrink-0",
                                  isSubActive
                                    ? "text-white"
                                    : "text-gray-400 group-hover:text-white"
                                )}
                              />

                              {subItem.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    to={item.href}
                    className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-[#58C5C7] text-white"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5 flex-shrink-0",
                        isActive
                          ? "text-white"
                          : "text-gray-400 group-hover:text-white"
                      )}
                    />

                    {item.name}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src="https://github.com/yusufhilmi.png" />

              <AvatarFallback className="bg-[#58C5C7] text-white">
                JD
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                Admin User
              </p>
              <p className="text-xs text-gray-400 truncate">admin@ringer.tel</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 h-16">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden"
              >
                <MenuIcon className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center space-x-4">
              {/* Customer Search */}
              <div className="relative hidden md:block">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />

                <Input
                  placeholder="Search customers..."
                  className="pl-10 w-64 bg-gray-50 border-gray-200 focus:bg-white"
                />
              </div>

              {/* Notifications */}
              <Button variant="ghost" size="sm" className="relative">
                <BellIcon className="h-5 w-5" />

                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 bg-[#FBAD18] text-xs flex items-center justify-center">
                  3
                </Badge>
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="https://github.com/yusufhilmi.png" />

                      <AvatarFallback className="bg-[#58C5C7] text-white">
                        JD
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:block text-sm font-medium">
                      Admin User
                    </span>
                    <ChevronDownIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem>
                    <UserIcon className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <HelpCircleIcon className="mr-2 h-4 w-4" />
                    Support
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />

                  <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
                    <LogOutIcon className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="min-h-[calc(100vh-4rem)] bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
