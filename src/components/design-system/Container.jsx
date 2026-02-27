import React from 'react';
import clsx from 'clsx';

export const Container = ({
  size = 'lg',
  className,
  children,
  ...props
}) => {
  const sizes = {
    sm: 'max-w-2xl',
    md: 'max-w-4xl',
    lg: 'max-w-6xl',
    xl: 'max-w-7xl',
    full: 'max-w-full',
  };

  const combinedClasses = clsx(
    'w-full mx-auto px-4 sm:px-6 lg:px-8',
    sizes[size],
    className
  );

  return (
    <div className={combinedClasses} {...props}>
      {children}
    </div>
  );
};

export default Container;
