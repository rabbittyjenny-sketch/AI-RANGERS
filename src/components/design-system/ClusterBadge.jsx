import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { BarChart3, Network, Database, Zap } from 'lucide-react';

const CLUSTER_ICONS = {
  'data': Database,
  'network': Network,
  'analytics': BarChart3,
  'performance': Zap,
};

export const ClusterBadge = ({
  cluster,
  isActive = false,
  onClick,
  size = 'md',
  interactive = true,
  ...props
}) => {
  if (!cluster) return null;

  const Icon = CLUSTER_ICONS[cluster.type] || Network;

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-3 text-base gap-3',
  };

  const baseClasses = clsx(
    'inline-flex items-center font-semibold rounded-lg transition-all duration-200 font-sarabun',
    isActive
      ? 'bg-[#5E9BEB] text-white shadow-lg'
      : 'bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200',
    interactive && 'cursor-pointer',
    sizes[size]
  );

  const content = (
    <div className={baseClasses} {...props}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{cluster.name || 'Cluster'}</span>
      {cluster.agentCount && (
        <span className="text-xs opacity-75">
          ({cluster.agentCount})
        </span>
      )}
    </div>
  );

  if (interactive) {
    return (
      <motion.button
        whileHover={isActive ? {} : { scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="bg-transparent border-none p-0"
      >
        {content}
      </motion.button>
    );
  }

  return content;
};

export default ClusterBadge;
