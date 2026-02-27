import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Container, Card, Button, BrandCard, Modal, Input } from '../components/design-system';
import { Plus, ArrowLeft, Search } from 'lucide-react';

export const BrandManager = ({ masterContext, onBack, onSelectBrand }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [newBrandForm, setNewBrandForm] = useState({
    nameTh: '',
    nameEn: '',
    industry: '',
    description: '',
  });

  const mockBrands = [
    {
      id: 1,
      nameTh: 'สมาร์ทฟาร์ม',
      nameEn: 'Smart Farm Co.',
      industry: 'Agriculture',
      description: 'AI-powered farming solutions',
      projectCount: 5,
      agentCount: 12,
      taskCount: 48,
      isActive: true,
    },
    {
      id: 2,
      nameTh: 'ดิจิตอลมาร์เก็ต',
      nameEn: 'Digital Market Plus',
      industry: 'E-commerce',
      description: 'Online marketplace platform',
      projectCount: 8,
      agentCount: 18,
      taskCount: 72,
      isActive: false,
    },
    {
      id: 3,
      nameTh: 'ฟิตเนส โกลด์',
      nameEn: 'Fitness Gold',
      industry: 'Health & Wellness',
      description: 'Premium fitness center network',
      projectCount: 3,
      agentCount: 8,
      taskCount: 32,
      isActive: false,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  const filteredBrands = mockBrands.filter(brand =>
    brand.nameTh.toLowerCase().includes(searchQuery.toLowerCase()) ||
    brand.nameEn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateBrand = () => {
    // Handle brand creation
    setShowNewBrandModal(false);
    setNewBrandForm({
      nameTh: '',
      nameEn: '',
      industry: '',
      description: '',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-8">
      <Container size="lg">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="mb-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[#5E9BEB] hover:text-[#4A7BC9] font-semibold mb-4 font-sarabun"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>

            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 font-sarabun">
                  Brand Manager
                </h1>
                <p className="text-gray-600 mt-2 font-sarabun">
                  Manage all your brands and projects in one place
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setShowNewBrandModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                New Brand
              </Button>
            </div>
          </motion.div>

          {/* Search */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-gray-300 focus:border-[#5E9BEB] focus:outline-none transition-colors font-sarabun"
              />
            </div>
          </motion.div>

          {/* Brands Grid */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredBrands.map((brand) => (
              <motion.div
                key={brand.id}
                variants={itemVariants}
                onClick={() => onSelectBrand(brand.id)}
              >
                <BrandCard
                  brand={brand}
                  isSelected={brand.isActive}
                  onClick={() => onSelectBrand(brand.id)}
                />
              </motion.div>
            ))}
          </motion.div>

          {filteredBrands.length === 0 && (
            <motion.div variants={itemVariants} className="text-center py-12">
              <Card>
                <p className="text-gray-600 font-sarabun text-lg">
                  No brands found matching your search
                </p>
              </Card>
            </motion.div>
          )}

          {/* Stats */}
          <motion.div variants={itemVariants} className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Total Brands', value: mockBrands.length },
              { label: 'Total Projects', value: mockBrands.reduce((sum, b) => sum + b.projectCount, 0) },
              { label: 'Total Agents', value: mockBrands.reduce((sum, b) => sum + b.agentCount, 0) },
            ].map((stat, idx) => (
              <Card key={idx}>
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#5E9BEB] font-sarabun">
                    {stat.value}
                  </p>
                  <p className="text-gray-600 mt-2 font-sarabun">
                    {stat.label}
                  </p>
                </div>
              </Card>
            ))}
          </motion.div>
        </motion.div>
      </Container>

      {/* New Brand Modal */}
      <Modal
        isOpen={showNewBrandModal}
        onClose={() => setShowNewBrandModal(false)}
        title="Create New Brand"
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowNewBrandModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateBrand}>
              Create Brand
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Thai Name"
            placeholder="ชื่อแบรนด์ไทย"
            value={newBrandForm.nameTh}
            onChange={(e) =>
              setNewBrandForm({ ...newBrandForm, nameTh: e.target.value })
            }
          />
          <Input
            label="English Name"
            placeholder="English Brand Name"
            value={newBrandForm.nameEn}
            onChange={(e) =>
              setNewBrandForm({ ...newBrandForm, nameEn: e.target.value })
            }
          />
          <Input
            label="Industry"
            placeholder="e.g., Technology, Fashion, Food"
            value={newBrandForm.industry}
            onChange={(e) =>
              setNewBrandForm({ ...newBrandForm, industry: e.target.value })
            }
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 font-sarabun">
              Description
            </label>
            <textarea
              placeholder="Brand description..."
              value={newBrandForm.description}
              onChange={(e) =>
                setNewBrandForm({ ...newBrandForm, description: e.target.value })
              }
              className="w-full px-4 py-3 rounded-lg border-2 border-gray-300 focus:border-[#5E9BEB] focus:outline-none transition-colors font-sarabun"
              rows="3"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BrandManager;
