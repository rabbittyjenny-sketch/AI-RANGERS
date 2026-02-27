import React from 'react';
import clsx from 'clsx';

export const Badge = ({
  variant = 'default',
  size = 'md',
  children,
  className,
  ...props
}) => {
  const variants = {
    default: 'bg-gray-100 text-gray-900 border border-gray-200',
    primary: 'bg-[#5E9BEB] text-white',
    success: 'bg-green-100 text-green-900 border border-green-300',
    warning: 'bg-yellow-100 text-yellow-900 border border-yellow-300',
    danger: 'bg-red-100 text-red-900 border border-red-300',
    info: 'bg-blue-100 text-blue-900 border border-blue-300',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs font-medium rounded',
    md: 'px-3 py-1.5 text-sm font-semibold rounded-md',
    lg: 'px-4 py-2 text-base font-semibold rounded-lg',
  };

  const combinedClasses = clsx(
    'inline-flex items-center gap-1 font-sarabun',
    variants[variant],
    sizes[size],
    className
  );

  return (
    <span className={combinedClasses} {...props}>
      {children}
    </span>
  );
};

export default Badge;
