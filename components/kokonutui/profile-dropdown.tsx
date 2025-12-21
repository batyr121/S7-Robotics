"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LogOut, User } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Profile {
    name: string;
    email: string;
    avatar: string;
    xp?: number;
    coins?: number;
}

interface MenuItem { }

const SAMPLE_PROFILE_DATA: Profile = {
    name: "Пользователь",
    email: "user@example.com",
    avatar: "/logo-s7.png",
    xp: 0,
    coins: 0,
};

interface ProfileDropdownProps extends React.HTMLAttributes<HTMLDivElement> {
    data?: Profile;
    onLogout?: () => void;
}

export default function ProfileDropdown({
    data = SAMPLE_PROFILE_DATA,
    onLogout,
    className,
    ...props
}: ProfileDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const menuItems: MenuItem[] = []

    return (
        <div className={cn("relative", className)} {...props}>
            <DropdownMenu onOpenChange={setIsOpen}>
                <div className="group relative">
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="flex items-center gap-4 p-3 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border-1)] hover:bg-[var(--color-surface-3)] transition-all duration-[var(--dur-fast)] focus:outline-none text-[var(--color-text-1)]"
                        >
                            <div className="text-left flex-1 min-w-0">
                                <div className="text-sm font-medium tracking-tight leading-tight truncate">
                                    {data.name}
                                </div>
                                <div className="text-xs text-[var(--color-text-3)] tracking-tight leading-tight truncate">{data.email}</div>
                                <div className="flex gap-2">
                                    {typeof data.xp === 'number' && (
                                        <div className="mt-1.5 text-xs font-semibold text-[#00a3ff]">XP: {data.xp}</div>
                                    )}
                                    {typeof data.coins === 'number' && (
                                        <div className="mt-1.5 text-xs font-semibold text-[#10b981]">S7: {data.coins}</div>
                                    )}
                                </div>
                            </div>
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full ring-2 ring-[#00a3ff]/40 ring-offset-2 ring-offset-[var(--color-surface-2)] bg-[var(--color-surface-1)] flex items-center justify-center">
                                    <User className="w-5 h-5 text-[var(--color-text-3)]" />
                                </div>
                            </div>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        sideOffset={4}
                        className="w-64 p-2 bg-[var(--color-surface-2)] border border-[var(--color-border-1)] rounded-2xl shadow-lg text-[var(--color-text-1)] origin-top-right"
                    >
                        <div className="px-2 pb-2">
                            <div className="text-sm font-medium">{data.name}</div>
                            <div className="text-xs text-[var(--color-text-3)]">{data.email}</div>
                            {typeof data.xp === 'number' && (
                                <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-1)] border border-[var(--color-border-1)] px-2 py-0.5 text-[11px] text-[#00a3ff]">XP: {data.xp}</div>
                            )}
                        </div>
                        {menuItems.length > 0 && (
                            <div className="space-y-1">

                            </div>
                        )}

                        <DropdownMenuSeparator className="my-3 bg-[var(--color-border-1)]" />

                        <DropdownMenuItem asChild>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--color-surface-3)] cursor-pointer transition-colors duration-[var(--dur-fast)]"
                            >
                                <LogOut className="w-4 h-4 text-red-400" />
                                <span className="text-sm font-medium text-red-400">Выйти</span>
                            </button>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </div>
            </DropdownMenu>
        </div>
    );
}
