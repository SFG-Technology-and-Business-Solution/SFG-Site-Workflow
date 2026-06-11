'use client';

import React, { useState } from 'react';
import {
    LayoutDashboard,
    Briefcase,
    ClipboardCheck,
    CheckCircle2,
    Truck,
    DoorOpen,
    Wrench,
    FileText,
    Calendar,
    Users,
    Settings,
    LogOut,
    Menu,
    X,
    Bell,
    Search,
    ChevronDown,
    Home,
    FilePlus,
    ClipboardList,
    Archive,
    DollarSign,
    GitBranch,
    MessageSquare,
} from 'lucide-react';
import { AIChatAssistant } from './ai-chat-assistant';
import { Logo } from './logo';
import { Avatar } from './ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AppLayoutProps {
    children: React.ReactNode;
}

// ... imports
import { useJobStats } from '@/lib/hooks';
import { WorkflowStep } from '@/lib/types';


export function AppLayout({ children }: AppLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
    const pathname = usePathname();
    const { stats, loading } = useJobStats();

    // Map href keys to WorkflowStep IDs for counting
    const stepMapping: Record<string, WorkflowStep> = {
        '/job-initiation': 'job_initiation',
        '/inspection': 'inspection',
        '/assessment': 'assessment',
        '/scheduling': 'scheduling',
        '/resourcing': 'resourcing',
        '/mobilisation': 'mobilisation',
        '/site-access': 'site_access',
        '/work-execution': 'work_execution',
        '/completion': 'completion',
        '/close-out': 'close_out',
        '/review-financials': 'review_financials',
    };

    return (
        <div className="min-h-screen bg-neutral-50 flex">
            {/* ... (Mobile Overlay) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-neutral-900/50 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-neutral-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="h-full flex flex-col">
                    {/* Sidebar Header */}
                    <div className="h-16 flex items-center px-6 border-b border-neutral-100">
                        <Logo />
                        <button
                            className="ml-auto lg:hidden p-1 text-neutral-500 hover:bg-neutral-100 rounded-md"
                            onClick={() => setIsSidebarOpen(false)}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
                        <div className="px-3 mb-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                            Overview
                        </div>
                        {[
                            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
                            { name: 'Jobs', href: '/jobs', icon: Briefcase },
                        ].map((item) => {
                            const isActive = pathname?.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`
                                        flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                                        ${isActive
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                                    `}
                                >
                                    <item.icon size={20} className={isActive ? 'text-primary-600' : 'text-neutral-400'} />
                                    {item.name}
                                </Link>
                            );
                        })}

                        <div className="px-3 mt-8 mb-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                            Workflow
                        </div>
                        {[
                            { name: 'Job Initiation', href: '/job-initiation', icon: FilePlus },
                            { name: 'Inspection', href: '/inspection', icon: ClipboardCheck },
                            { name: 'Assessment', href: '/assessment', icon: ClipboardList },
                            { name: 'Scheduling', href: '/scheduling', icon: Calendar },
                            { name: 'Resourcing', href: '/resourcing', icon: Users },
                            { name: 'Mobilisation', href: '/mobilisation', icon: Truck },
                            { name: 'Site Access', href: '/site-access', icon: DoorOpen },
                            { name: 'Work Execution', href: '/work-execution', icon: Wrench },
                            { name: 'Completion', href: '/completion', icon: CheckCircle2 },
                            { name: 'Close Out', href: '/close-out', icon: Archive },
                            { name: 'Review & Financials', href: '/review-financials', icon: DollarSign },
                        ].map((item) => {
                            const isActive = pathname?.startsWith(item.href);
                            const stepId = stepMapping[item.href];
                            const count = !loading && stepId ? stats.stepCounts[stepId] : 0;

                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`
                                        flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors
                                        ${isActive
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon size={20} className={isActive ? 'text-primary-600' : 'text-neutral-400'} />
                                        {item.name}
                                    </div>
                                    {count > 0 && (
                                        <span className={`
                                            px-2 py-0.5 text-xs rounded-full 
                                            ${isActive ? 'bg-primary-100 text-primary-700' : 'bg-neutral-100 text-neutral-600'}
                                        `}>
                                            {count}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}

                        <div className="px-3 mt-8 mb-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                            Improvement
                        </div>
                        {[
                            { name: 'VSM Buddy', href: '/value-stream', icon: GitBranch },
                        ].map((item) => {
                            const isActive = pathname?.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`
                                        flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                                        ${isActive
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                                    `}
                                >
                                    <item.icon size={20} className={isActive ? 'text-primary-600' : 'text-neutral-400'} />
                                    {item.name}
                                </Link>
                            );
                        })}

                        <div className="px-3 mt-8 mb-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                            Management
                        </div>
                        {[
                            { name: 'Reports', href: '/reports', icon: FileText },
                            { name: 'Admin', href: '/admin', icon: Settings },
                        ].map((item) => {
                            const isActive = pathname?.startsWith(item.href);
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`
                                        flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                                        ${isActive
                                            ? 'bg-primary-50 text-primary-700'
                                            : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'}
                                    `}
                                >
                                    <item.icon size={20} className={isActive ? 'text-primary-600' : 'text-neutral-400'} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Feedback */}
                    <div className="px-4 pb-1">
                        <a
                            href={`mailto:adrian.r@sfgtechsolutions.com?subject=${encodeURIComponent('Site Buddy feedback')}&body=${encodeURIComponent('What were you trying to do?\n\nWhat happened (or what was confusing)?\n\nPage you were on:\n')}`}
                            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                        >
                            <MessageSquare size={20} className="text-neutral-400" />
                            Send feedback
                        </a>
                    </div>

                    {/* User Profile */}
                    <div className="p-4 border-t border-neutral-200">
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 cursor-pointer">
                            <Avatar name="Admin User" size="sm" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-neutral-900 truncate">Admin User</p>
                                <p className="text-xs text-neutral-500 truncate">admin@sitebuddy.com</p>
                            </div>
                            <LogOut size={16} className="text-neutral-400" />
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-neutral-200 flex items-center gap-4 px-4 sm:px-6 lg:px-8 z-10 sticky top-0">
                    <button
                        className="lg:hidden p-2 -ml-2 text-neutral-500 hover:bg-neutral-100 rounded-md"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu size={24} />
                    </button>

                    <div className="flex-1 flex justify-end md:justify-start">
                        {/* Mobile Center Logo */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden">
                            <a href="https://agent-6982dbe2550252d2d721c5c--sfg-site-workflow.netlify.app/" target="_blank" rel="noopener noreferrer">
                                <img
                                    src="https://i.postimg.cc/tJHyDTnJ/Deploy-by-(1).png"
                                    alt="Deployed by"
                                    className="h-20 w-auto object-contain"
                                />
                            </a>
                        </div>
                        <div className="w-full max-w-lg lg:max-w-xs relative text-neutral-500 focus-within:text-neutral-600 hidden md:block">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={18} />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2 border border-transparent rounded-md leading-5 bg-neutral-100 text-neutral-900 placeholder-neutral-500 focus:outline-none focus:bg-white focus:border-neutral-300 focus:ring-0 sm:text-sm transition-colors"
                                placeholder="Search jobs, reports..."
                            />
                        </div>
                        {/* Mobile Search Icon */}
                        <button
                            className="md:hidden p-2 text-neutral-400 hover:text-neutral-500"
                            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                        >
                            <Search size={20} />
                        </button>
                    </div>

                    {/* Mobile Search Overlay */}
                    {isMobileSearchOpen && (
                        <div className="absolute inset-x-0 top-0 h-16 bg-white border-b border-neutral-200 px-4 flex items-center gap-2 z-20 md:hidden animate-in fade-in slide-in-from-top-2">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                                    <Search size={18} />
                                </div>
                                <input
                                    type="text"
                                    autoFocus
                                    className="block w-full pl-10 pr-3 py-2 border border-neutral-200 rounded-lg leading-5 bg-neutral-50 text-neutral-900 placeholder-neutral-500 focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm transition-colors"
                                    placeholder="Search jobs, reports..."
                                />
                            </div>
                            <button
                                className="p-2 text-neutral-500 hover:bg-neutral-100 rounded-md"
                                onClick={() => setIsMobileSearchOpen(false)}
                            >
                                <span className="text-sm font-medium">Cancel</span>
                            </button>
                        </div>
                    )}

                    {/* Deployed By Logo - Dashboard Header */}
                    <div className="hidden md:flex items-center mr-4">
                        <a href="https://agent-6982dbe2550252d2d721c5c--sfg-site-workflow.netlify.app/" target="_blank" rel="noopener noreferrer">
                            <img
                                src="https://i.postimg.cc/tJHyDTnJ/Deploy-by-(1).png"
                                alt="Deployed by"
                                className="h-12 w-auto object-contain"
                            />
                        </a>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-4">
                        <button className="relative p-2 text-neutral-400 hover:text-neutral-500 transition-colors">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 block w-2 h-2 rounded-full bg-accent-red ring-2 ring-white" />
                        </button>
                    </div>
                </header>

                {/* Main Page Content */}
                <main className="flex-1 overflow-y-auto bg-neutral-50 p-4 sm:p-6 lg:p-8">
                    <div className="max-w-7xl mx-auto w-full">
                        {children}
                    </div>
                </main>
            </div>
            {/* AI Assistant */}
            <AIChatAssistant />
        </div>
    );
}
