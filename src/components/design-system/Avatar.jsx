import React from 'react';
import clsx from 'clsx';

export const Avatar = ({
  src,
  alt = 'Avatar',
  size = 'md',
  fallback = '?',
  className,
  ...props
}) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const baseClasses = clsx(
    'rounded-full flex items-center justify-center font-semibold overflow-hidden bg-gradient-to-br from-[#5E9BEB] to-[#4A7BC9] text-white',
    sizes[size],
    className
  );

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={baseClasses}
        {...props}
      />
    );
  }

  return (
    <div className={baseClasses} {...props}>
      {fallback}
    </div>
  );
};

export default Avatar;
