import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboardIcon,
  PhoneIcon,
  HashIcon,
  CreditCardIcon,
  HeadphonesIcon,
  SettingsIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboardIcon,
  },
  {
    name: "SIP Trunks",
    href: "/trunks",
    icon: PhoneIcon,
  },
  {
    name: "DID Numbers",
    href: "/numbers",
    icon: HashIcon,
  },
  {
    name: "Billing",
    href: "/billing",
    icon: CreditCardIcon,
  },
  {
    name: "Support",
    href: "/support",
    icon: HeadphonesIcon,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: SettingsIcon,
  },
];

export function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const location = useLocation();

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-background border-r transition-all duration-200",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "justify-start"
          )}
        >
          <img
            src="https://assets.polymet.ai/blushing-purple-167610"
            alt="Ringer"
            className={cn(
              "transition-all duration-200",
              isCollapsed ? "h-8 w-8" : "h-8 w-auto max-w-[120px]"
            )}
          />
        </div>

        {!isCollapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                isCollapsed && "justify-center px-2"
              )}
            >
              <item.icon
                className={cn("h-5 w-5", isCollapsed ? "" : "flex-shrink-0")}
              />

              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="p-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0 mx-auto"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
