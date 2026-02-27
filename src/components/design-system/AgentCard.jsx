import React from 'react';
import { motion } from 'framer-motion';
import { Card, Badge, Avatar } from './index';
import { ChevronRight, Zap, MessageSquare } from 'lucide-react';

export const AgentCard = ({
  agent,
  onClick,
  ...props
}) => {
  if (!agent) return null;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ y: 0 }}
      onClick={onClick}
    >
      <Card interactive className="h-full" {...props}>
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Avatar
                fallback={agent.name?.charAt(0) || '?'}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 font-sarabun truncate">
                  {agent.name || 'Unnamed Agent'}
                </h3>
                <p className="text-xs text-gray-500 truncate">
                  {agent.type || 'AI Agent'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-2 font-sarabun">
            {agent.description || 'No description'}
          </p>

          {/* Tags/Capabilities */}
          <div className="flex flex-wrap gap-2">
            {agent.capabilities?.slice(0, 2).map((cap, idx) => (
              <Badge key={idx} variant="primary" size="sm">
                {cap}
              </Badge>
            ))}
            {agent.capabilities?.length > 2 && (
              <Badge variant="default" size="sm">
                +{agent.capabilities.length - 2}
              </Badge>
            )}
          </div>

          {/* Status/Stats */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-xs text-gray-500 font-sarabun">
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              <span>{agent.conversations || 0} conversations</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-500" />
              <span>{agent.efficiency || '80'}%</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default AgentCard;
