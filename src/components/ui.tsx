// UI Components

'use client';

import React, { ReactNode } from 'react';

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
    icon: ReactNode;
    value: number | string;
    label: string;
    colorClass?: 'blue' | 'green' | 'amber' | 'red';
}

export function StatCard({ icon, value, label, colorClass = 'blue' }: StatCardProps) {
    const colors = {
        blue: 'bg-primary-100 text-primary-600',
        green: 'bg-success-light text-success',
        amber: 'bg-warning-light text-warning',
        red: 'bg-accent-red-light text-accent-red',
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-neutral-200 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors[colorClass]}`}>
                {icon}
            </div>
            <div>
                <div className="text-2xl font-bold text-primary-900">{value}</div>
                <div className="text-sm text-neutral-500 font-medium">{label}</div>
            </div>
        </div>
    );
}

// ============================================
// CARD
// ============================================

interface CardProps {
    children: ReactNode;
    className?: string;
    elevated?: boolean;
    style?: React.CSSProperties;
}

export function Card({ children, className = '', elevated = false, style }: CardProps) {
    return (
        <div className={`bg-white rounded-xl border border-neutral-200 overflow-hidden ${elevated ? 'shadow-md border-0' : ''} ${className}`} style={style}>
            {children}
        </div>
    );
}

interface CardHeaderProps {
    children: ReactNode;
    action?: ReactNode;
}

export function CardHeader({ children, action }: CardHeaderProps) {
    return (
        <div className="px-6 py-5 border-b border-neutral-200 flex justify-between items-center bg-white">
            <div>{children}</div>
            {action && <div>{action}</div>}
        </div>
    );
}

interface CardBodyProps {
    children: ReactNode;
    style?: React.CSSProperties;
    className?: string;
}

export function CardBody({ children, style, className = '' }: CardBodyProps) {
    return <div className={`p-6 ${className}`} style={style}>{children}</div>;
}

// ============================================
// BUTTON
// ============================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: ReactNode;
    loading?: boolean;
}

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    const sizeClasses = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-5 py-3 text-sm',
        lg: 'px-6 py-4 text-base',
    };

    const variantClasses = {
        primary: 'bg-primary-600 text-white border-primary-600 hover:bg-primary-700 hover:border-primary-700',
        secondary: 'bg-white text-primary-700 border-neutral-300 hover:bg-neutral-50 hover:border-neutral-400',
        ghost: 'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-primary-700 border-transparent',
    };

    return (
        <button
            className={`
                inline-flex items-center justify-center gap-2 font-medium rounded-lg border transition-all whitespace-nowrap
                ${sizeClasses[size]}
                ${variantClasses[variant]}
                ${disabled || loading ? 'opacity-60 cursor-not-allowed' : ''}
                ${className}
            `}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : icon ? (
                <>
                    {icon}
                    {children}
                </>
            ) : (
                children
            )}
        </button>
    );
}
