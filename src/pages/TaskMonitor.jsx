import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Container, Card, Badge, Button } from '../components/design-system';
import { CheckCircle, AlertCircle, Clock, ChevronDown, ArrowLeft } from 'lucide-react';

export const TaskMonitor = ({ onBack }) => {
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const mockTasks = [
    {
      id: 1,
      title: 'Create Instagram Post',
      status: 'completed',
      agent: 'Content Creator',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() - 1800000),
      description: 'Generated and scheduled Instagram post for product launch',
      result: 'Successfully created 3 variations of Instagram post',
    },
    {
      id: 2,
      title: 'Analyze Engagement Metrics',
      status: 'completed',
      agent: 'Analytics Bot',
      startTime: new Date(Date.now() - 7200000),
      endTime: new Date(Date.now() - 5400000),
      description: 'Analyzed engagement metrics for last month',
      result: 'Generated detailed analytics report with 12% engagement increase',
    },
    {
      id: 3,
      title: 'Community Response Management',
      status: 'in_progress',
      agent: 'Community Manager',
      startTime: new Date(Date.now() - 1800000),
      endTime: null,
      description: 'Responding to community comments and messages',
      progress: 67,
    },
    {
      id: 4,
      title: 'Trend Research',
      status: 'pending',
      agent: 'Trend Scout',
      startTime: new Date(Date.now() + 3600000),
      endTime: null,
      description: 'Will analyze emerging trends in your industry',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'info';
      case 'failed':
        return 'danger';
      default:
        return 'default';
    }
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
            <h1 className="text-3xl font-bold text-gray-900 font-sarabun">
              Task Monitor
            </h1>
            <p className="text-gray-600 mt-2 font-sarabun">
              Track all your agent tasks and executions
            </p>
          </motion.div>

          {/* Timeline */}
          <motion.div variants={containerVariants} className="space-y-4">
            {mockTasks.map((task, idx) => (
              <motion.div
                key={task.id}
                variants={itemVariants}
                className="relative"
              >
                <Card
                  interactive
                  onClick={() =>
                    setExpandedTaskId(
                      expandedTaskId === task.id ? null : task.id
                    )
                  }
                >
                  {/* Main Task Info */}
                  <div className="flex items-start gap-4">
                    {/* Timeline Dot */}
                    <div className="flex flex-col items-center pt-2">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {getStatusIcon(task.status)}
                      </div>
                      {idx < mockTasks.length - 1 && (
                        <div className="w-0.5 h-20 bg-gray-200 my-2" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 font-sarabun text-lg">
                            {task.title}
                          </h3>
                          <p className="text-sm text-gray-600 font-sarabun">
                            {task.agent}
                          </p>
                        </div>
                        <Badge
                          variant={getStatusBadgeVariant(task.status)}
                          size="sm"
                          className="flex-shrink-0"
                        >
                          {task.status.charAt(0).toUpperCase() +
                            task.status.slice(1).replace('_', ' ')}
                        </Badge>
                      </div>

                      {/* Progress Bar */}
                      {task.status === 'in_progress' && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1 font-sarabun">
                            <span>Progress</span>
                            <span>{task.progress}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${task.progress}%` }}
                              transition={{ duration: 0.6 }}
                              className="h-full bg-gradient-to-r from-[#5E9BEB] to-[#4A7BC9]"
                            />
                          </div>
                        </div>
                      )}

                      {/* Time Info */}
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500 font-sarabun">
                        <span>
                          Start: {task.startTime.toLocaleString()}
                        </span>
                        {task.endTime && (
                          <span>
                            End: {task.endTime.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Expand Button */}
                      <motion.div
                        animate={{ rotate: expandedTaskId === task.id ? 180 : 0 }}
                        className="absolute top-6 right-6"
                      >
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      </motion.div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{
                      opacity: expandedTaskId === task.id ? 1 : 0,
                      height: expandedTaskId === task.id ? 'auto' : 0,
                    }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    {expandedTaskId === task.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-1 font-sarabun">
                            Description
                          </p>
                          <p className="text-sm text-gray-600 font-sarabun">
                            {task.description}
                          </p>
                        </div>

                        {task.result && (
                          <div>
                            <p className="text-sm font-semibold text-gray-700 mb-1 font-sarabun">
                              Result
                            </p>
                            <p className="text-sm text-gray-600 font-sarabun">
                              {task.result}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button variant="secondary" size="sm">
                            View Details
                          </Button>
                          <Button variant="ghost" size="sm">
                            Retry
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </Container>
    </div>
  );
};

export default TaskMonitor;
