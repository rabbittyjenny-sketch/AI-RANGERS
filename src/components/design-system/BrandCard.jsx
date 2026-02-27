import React from 'react';
import { motion } from 'framer-motion';
import { Card, Avatar, Badge } from './index';
import { ArrowRight, Briefcase } from 'lucide-react';

export const BrandCard = ({
  brand,
  isSelected = false,
  onClick,
  ...props
}) => {
  if (!brand) return null;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      whileTap={{ y: 0 }}
      onClick={onClick}
    >
      <Card
        interactive
        className={`h-full border-2 ${isSelected ? 'border-[#5E9BEB]' : 'border-gray-200'}`}
        {...props}
      >
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Avatar
                fallback={brand.nameEn?.charAt(0) || 'B'}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 font-sarabun">
                  {brand.nameTh || brand.nameEn || 'Unnamed Brand'}
                </h3>
                <p className="text-xs text-gray-500">
                  {brand.industry || 'N/A'}
                </p>
              </div>
            </div>
            {isSelected && (
              <div className="flex-shrink-0">
                <Badge variant="primary" size="sm">
                  Active
                </Badge>
              </div>
            )}
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-2 font-sarabun">
            {brand.description || 'No description provided'}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200">
            <div className="text-center text-xs">
              <div className="font-semibold text-gray-900">
                {brand.projectCount || 0}
              </div>
              <div className="text-gray-500 font-sarabun">Projects</div>
            </div>
            <div className="text-center text-xs">
              <div className="font-semibold text-gray-900">
                {brand.agentCount || 0}
              </div>
              <div className="text-gray-500 font-sarabun">Agents</div>
            </div>
            <div className="text-center text-xs">
              <div className="font-semibold text-gray-900">
                {brand.taskCount || 0}
              </div>
              <div className="text-gray-500 font-sarabun">Tasks</div>
            </div>
          </div>

          {/* CTA */}
          <button className="flex items-center justify-center gap-2 w-full mt-2 px-3 py-2 bg-[#5E9BEB] text-white rounded-lg font-semibold text-sm hover:bg-[#4A7BC9] transition-colors font-sarabun">
            <Briefcase className="w-4 h-4" />
            Manage Brand
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Card>
    </motion.div>
  );
};

export default BrandCard;
