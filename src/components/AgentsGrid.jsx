import React, { useState, useRef, useEffect } from 'react';
import { getAgentsByCluster, clusterMetadata, getAgentById } from '../data/agents';
import { ChevronLeft, MessageSquare, Zap, Send, Paperclip, Mic, MicOff, Loader2, Image as ImageIcon, X, ClipboardList } from 'lucide-react';
import { aiService } from '../services/aiService';
import { orchestratorEngine } from '../services/orchestratorEngine';

const AgentsGrid = ({ clusterId, onBack, onSelectAgent, masterContext }) => {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const agents = getAgentsByCluster(clusterId);
  const cluster = clusterMetadata[clusterId];

  if (!cluster) {
    return (
      <div className="error-state">
        <p>Cluster not found</p>
        <button onClick={onBack}>Go Back</button>
      </div>
    );
  }

  const handleAgentSelect = (agentId) => {
    setSelectedAgent(agentId);
    onSelectAgent(agentId);
  };

  return (
    <div className="agents-grid-container">
      {/* Header */}
      <div className="agents-header">
        <button className="back-btn" onClick={onBack}>
          <ChevronLeft size={24} />
          Back
        </button>

        <div className="cluster-info">
          <span style={{ fontSize: '32px', marginRight: '10px' }}>{cluster.emoji}</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px' }}>{cluster.name}</h1>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.6 }}>
              {cluster.nameTh}
            </p>
          </div>
        </div>

        <p className="cluster-description">{cluster.description}</p>
      </div>

      {/* Agents Grid */}
      <div className="agents-cards-grid">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`agent-card neo-box ${selectedAgent === agent.id ? 'active' : ''}`}
            style={{
              borderColor: agent.color,
              borderWidth: '2px',
              cursor: 'pointer',
              background: selectedAgent === agent.id ? `${agent.color}10` : 'white',
              transition: 'all 0.3s ease'
            }}
            onClick={() => handleAgentSelect(agent.id)}
          >
            {/* Agent Header */}
            <div className="agent-header" style={{ marginBottom: '15px' }}>
              <div style={{ fontSize: '40px', marginRight: '10px' }}>{agent.emoji}</div>
              <div>
                <h3 style={{ color: agent.color, margin: '0 0 5px 0' }}>{agent.name}</h3>
                <p style={{ fontSize: '12px', margin: 0, opacity: 0.6 }}>{agent.nameEn}</p>
              </div>
            </div>

            {/* Description */}
            <p className="agent-description">{agent.descriptionTh}</p>

            {/* Capabilities */}
            <div className="agent-section">
              <p className="section-label">Capabilities:</p>
              <div className="tags">
                {agent.capabilities.slice(0, 4).map((cap) => (
                  <span key={cap} className="tag" style={{ backgroundColor: `${agent.color}20`, color: agent.color }}>
                    {cap}
                  </span>
                ))}
                {agent.capabilities.length > 4 && (
                  <span className="tag" style={{ backgroundColor: '#f0f0f0' }}>
                    +{agent.capabilities.length - 4} more
                  </span>
                )}
              </div>
            </div>

            {/* Business Functions */}
            <div className="agent-section">
              <p className="section-label">What can do:</p>
              <ul className="function-list">
                {agent.businessFunctions.slice(0, 3).map((func) => (
                  <li key={func}>{func}</li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <button
              className="neo-btn agent-cta"
              style={{
                background: agent.color,
                color: 'white',
                width: '100%',
                marginTop: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontWeight: 600
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleAgentSelect(agent.id);
              }}
            >
              <MessageSquare size={16} />
              Chat with {agent.name}
            </button>
          </div>
        ))}
      </div>

      {/* Chat Interface (if agent selected) */}
      {selectedAgent && masterContext && (
        <ChatInterface
          agentId={selectedAgent}
          masterContext={masterContext}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Styles */}
      <style>{`
        .agents-grid-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          animation: fadeIn 0.6s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .agents-header {
          margin-bottom: 40px;
        }

        .back-btn {
          background: none;
          border: 2px solid #ddd;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 14px;
          margin-bottom: 20px;
          transition: all 0.3s ease;
        }

        .back-btn:hover {
          border-color: #333;
          background: #f5f5f5;
        }

        .cluster-info {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }

        .cluster-description {
          font-size: 14px;
          color: #666;
          margin: 0;
        }

        .agents-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .agent-card {
          padding: 20px;
          background: white;
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .agent-card:hover {
          box-shadow: var(--shadow-hard-hover);
          transform: translateY(-4px);
        }

        .agent-card.active {
          box-shadow: var(--shadow-hard-hover);
        }

        .agent-header {
          display: flex;
          align-items: center;
        }

        .agent-description {
          font-size: 13px;
          line-height: 1.5;
          color: #555;
          margin: 0 0 15px 0;
        }

        .agent-section {
          margin-bottom: 12px;
        }

        .section-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.6;
          margin: 0 0 8px 0;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tag {
          font-size: 11px;
          padding: 4px 8px;
          border-radius: 4px;
          background: #f0f0f0;
          white-space: nowrap;
        }

        .function-list {
          margin: 0;
          padding-left: 18px;
          font-size: 12px;
        }

        .function-list li {
          margin-bottom: 4px;
          line-height: 1.4;
        }

        .agent-cta {
          font-size: 13px;
          padding: 10px;
        }

        .error-state {
          text-align: center;
          padding: 40px;
          background: #f5f5f5;
          border-radius: 12px;
        }

        @media (max-width: 768px) {
          .agents-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

/**
 * Full-Featured Chat Interface Component with:
 * - Real AI agent responses via aiService
 * - File/Image attachment support
 * - Speech-to-text (voice input)
 * - Markdown-style formatting
 */
const ChatInterface = ({ agentId, masterContext, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [error, setError] = useState('');
  const [showTaskPrompt, setShowTaskPrompt] = useState(false);
  const [taskPromptData, setTaskPromptData] = useState({});
  const [taskQuestions, setTaskQuestions] = useState(null);

  // Check for Part B task-specific questions on mount
  useEffect(() => {
    if (orchestratorEngine.needsTaskSpecificData(agentId)) {
      const prompts = orchestratorEngine.getTaskSpecificQuestions(agentId);
      if (prompts) {
        setTaskQuestions(prompts);
        setShowTaskPrompt(true);
      }
    }
  }, [agentId]);

  const handleTaskPromptSubmit = () => {
    // Save Part B data to orchestrator
    orchestratorEngine.setTaskSpecificData(agentId, taskPromptData);
    setShowTaskPrompt(false);

    // Add a system message showing that task data was collected
    const systemMsg = {
      id: Date.now(),
      role: 'agent',
      content: `✅ Task preferences saved! I now have your specific settings for this session.\n\n${Object.entries(taskPromptData).map(([k, v]) => `• ${k}: ${v}`).join('\n')}\n\nHow can I help you today?`,
      agentName: agent?.name,
      timestamp: new Date()
    };
    setMessages((prev) => [...prev, systemMsg]);
  };

  const handleTaskPromptSkip = () => {
    // Mark as seen but don't save data
    orchestratorEngine.setTaskSpecificData(agentId, {});
    setShowTaskPrompt(false);
  };
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const preVoiceInputRef = useRef('');

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'th-TH'; // Thai language

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interim += transcript;
          }
        }
        // Show interim text as preview (not committed to input)
        setInterimTranscript(interim);
        // Only append final (confirmed) transcript to input
        if (finalTranscript) {
          setInputValue((prev) => prev + finalTranscript);
          setInterimTranscript('');
        }
      };

      recognitionRef.current.onerror = (event) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };
    }
  }, []);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const agent = getAgentById(agentId);

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const textInput = inputValue.trim();
    const hasFiles = attachedFiles.length > 0;

    if (!textInput && !hasFiles) return;

    // Build message content including file descriptions
    let messageContent = textInput;
    if (hasFiles && !textInput) {
      const fileNames = attachedFiles.map((f) => f.name).join(', ');
      messageContent = `[Attached: ${fileNames}]`;
    }

    // Build AI input that includes file context
    let aiInput = textInput;
    if (hasFiles) {
      const fileDescriptions = attachedFiles
        .map((f) => `${f.name} (${f.type}, ${Math.round(f.size / 1024)}KB)`)
        .join(', ');
      aiInput = textInput
        ? `${textInput}\n\n[Attached files: ${fileDescriptions}]`
        : `Please analyze the attached file(s): ${fileDescriptions}`;
    }

    // Create user message with attachments
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: messageContent,
      attachments: attachedFiles,
      timestamp: new Date()
    };

    // Capture files before clearing state
    const currentFiles = [...attachedFiles];
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setAttachedFiles([]);
    setInterimTranscript('');
    setIsLoading(true);
    setError('');

    try {
      // Call the real AI Service to get agent response
      const aiResponse = await aiService.processMessage({
        userInput: aiInput,
        context: masterContext,
        forceAgent: agentId,
        attachments: currentFiles
      });

      // Add agent's response
      const agentMessage = {
        id: Date.now() + 1,
        role: 'agent',
        content: aiResponse.content,
        agentName: aiResponse.agentName,
        confidence: aiResponse.confidence,
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, agentMessage]);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      setError(`Error: ${err.message}`);

      // Fallback response
      const fallbackMessage = {
        id: Date.now() + 1,
        role: 'agent',
        content: `⚠️ System Error\n\nUnable to process request: ${err.message}\n\nPlease ensure you have completed Onboarding with your brand information.`,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    }
  };

  const handleFileAttachment = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            size: file.size,
            data: event.target.result
          }
        ]);
      };
      reader.onerror = () => {
        setError(`Failed to read file: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });

    // Reset file input so the same file can be re-attached
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleSpeech = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      preVoiceInputRef.current = inputValue;
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const removeAttachment = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="chat-interface">
      {/* Chat Header */}
      <div className="chat-header">
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
            {agent?.emoji} {agent?.name}
          </h3>
          <p style={{ margin: '3px 0 0 0', fontSize: '11px', opacity: 0.6 }}>
            {agent?.descriptionTh}
          </p>
        </div>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '10px 12px',
          background: '#fee',
          borderBottom: '1px solid #fcc',
          fontSize: '12px',
          color: '#c33'
        }}>
          {error}
        </div>
      )}

      {/* Part B: Task-Specific Questions Overlay */}
      {showTaskPrompt && taskQuestions && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255,255,255,0.97)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ClipboardList size={18} style={{ color: '#FF1493' }} />
            <h4 style={{ margin: 0, fontSize: '14px' }}>Quick Setup</h4>
          </div>
          <p style={{ fontSize: '11px', color: '#666', margin: '0 0 16px 0' }}>
            A few quick questions to personalize your experience with this agent.
          </p>
          {taskQuestions.questions.map((q) => (
            <div key={q.id} style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                {q.questionTh}
                {q.required && <span style={{ color: '#FF1493' }}>*</span>}
              </label>
              {q.type === 'select' ? (
                <select
                  value={taskPromptData[q.id] || ''}
                  onChange={(e) => setTaskPromptData(prev => ({ ...prev, [q.id]: e.target.value }))}
                  style={{
                    width: '100%', padding: '8px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit'
                  }}
                >
                  <option value="">-- Select --</option>
                  {q.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : q.type === 'multiselect' ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {q.options?.map(opt => {
                    const selected = (taskPromptData[q.id] || '').includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const current = taskPromptData[q.id] || '';
                          const items = current ? current.split(', ').filter(Boolean) : [];
                          const newItems = selected
                            ? items.filter(i => i !== opt)
                            : [...items, opt];
                          setTaskPromptData(prev => ({ ...prev, [q.id]: newItems.join(', ') }));
                        }}
                        style={{
                          padding: '5px 10px', fontSize: '11px', borderRadius: '4px',
                          border: selected ? '2px solid #FF1493' : '1px solid #ddd',
                          background: selected ? '#ffe0ec' : 'white',
                          cursor: 'pointer', fontFamily: 'inherit'
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={taskPromptData[q.id] || ''}
                  onChange={(e) => setTaskPromptData(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder={q.placeholder || ''}
                  style={{
                    width: '100%', padding: '8px', border: '1px solid #ddd',
                    borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                />
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={handleTaskPromptSubmit}
              style={{
                flex: 1, padding: '10px', background: '#FF1493', color: 'white',
                border: 'none', borderRadius: '6px', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              Save & Start
            </button>
            <button
              onClick={handleTaskPromptSkip}
              style={{
                padding: '10px 16px', background: 'white', color: '#666',
                border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px',
                cursor: 'pointer', fontFamily: 'inherit'
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !showTaskPrompt && (
          <div className="empty-chat">
            <p style={{ fontSize: '12px', color: '#999' }}>
              💬 Start a conversation with {agent?.name}
            </p>
            <p style={{ fontSize: '11px', color: '#ccc', margin: '8px 0 0 0' }}>
              • Type your question
              • Attach files/images
              • Use voice input
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.role === 'agent' && msg.agentName && (
              <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7, marginBottom: '4px' }}>
                {msg.agentName}
                {msg.confidence && ` (${Math.round(msg.confidence)}% confidence)`}
              </div>
            )}
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
              {msg.content}
            </p>
            {msg.attachments && msg.attachments.length > 0 && (
              <div style={{ marginTop: '8px', fontSize: '11px' }}>
                📎 {msg.attachments.map((a) => a.name).join(', ')}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="message agent">
            <p style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              Thinking...
            </p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          padding: '10px',
          background: '#f9f9f9',
          borderBottom: '1px solid #eee'
        }}>
          {attachedFiles.map((file, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '11px'
              }}
            >
              {file.type.startsWith('image/') ? (
                <ImageIcon size={12} />
              ) : (
                <Paperclip size={12} />
              )}
              <span>{file.name}</span>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0',
                  marginLeft: '4px',
                  color: '#999'
                }}
                onClick={() => removeAttachment(idx)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chat Input Form */}
      <form onSubmit={handleSendMessage} className="chat-input-form">
        <button
          type="button"
          className="icon-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file or image"
        >
          <Paperclip size={16} />
        </button>

        <button
          type="button"
          className={`icon-btn ${isListening ? 'listening' : ''}`}
          onClick={toggleSpeech}
          title={isListening ? 'Stop recording' : 'Start voice input'}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <input
          type="text"
          value={inputValue + (interimTranscript ? interimTranscript : '')}
          onChange={(e) => {
            // Strip interim transcript portion if user types manually
            setInterimTranscript('');
            setInputValue(e.target.value);
          }}
          placeholder={isListening ? 'Listening...' : 'Ask your question or use voice...'}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: `1px solid ${isListening ? '#FF1493' : '#ddd'}`,
            borderRadius: '6px',
            fontSize: '12px',
            outline: 'none',
            fontFamily: 'inherit',
            color: interimTranscript ? '#999' : '#333'
          }}
          onFocus={(e) => e.target.style.borderColor = '#FF1493'}
          onBlur={(e) => { if (!isListening) e.target.style.borderColor = '#ddd'; }}
        />

        <button
          type="submit"
          disabled={isLoading || (!inputValue.trim() && attachedFiles.length === 0)}
          className="send-btn"
        >
          {isLoading ? (
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Send size={16} />
          )}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileAttachment}
          style={{ display: 'none' }}
        />
      </form>

      {/* Styles */}
      <style>{`
        .chat-interface {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 450px;
          max-height: 700px;
          background: white;
          border: 2px solid #000;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
          z-index: 1000;
          animation: slideUp 0.3s ease;
          overflow: hidden;
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .chat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          border-bottom: 2px solid #000;
          background: white;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          color: #333;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          color: #FF1493;
          transform: scale(1.2);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 15px;
          background: #fafafa;
        }

        .empty-chat {
          text-align: center;
          color: #999;
          padding: 30px 20px;
        }

        .message {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.4;
          max-width: 90%;
        }

        .message.user {
          background: #FF1493;
          color: white;
          margin-left: auto;
          margin-right: 0;
          border-bottom-right-radius: 2px;
        }

        .message.agent {
          background: white;
          color: #333;
          margin-left: 0;
          margin-right: auto;
          border: 1px solid #eee;
          border-bottom-left-radius: 2px;
        }

        .chat-input-form {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-top: 2px solid #000;
          background: white;
          align-items: center;
        }

        .icon-btn {
          background: white;
          border: 1px solid #ddd;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .icon-btn:hover {
          border-color: #FF1493;
          color: #FF1493;
        }

        .icon-btn.listening {
          background: #ffe0e6;
          border-color: #FF1493;
          color: #FF1493;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .send-btn {
          background: #FF1493;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          background: #FF1493DD;
          transform: scale(1.05);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .chat-interface {
            width: calc(100vw - 40px);
            bottom: 10px;
            right: 10px;
            max-height: 60vh;
          }
        }
      `}</style>
    </div>
  );
};

export default AgentsGrid;
