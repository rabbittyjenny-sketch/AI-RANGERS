import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Container, Button, Avatar } from '../components/design-system';
import { Send, ArrowLeft, AlertCircle, Mic, Paperclip, X, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { aiService } from '../services/aiService';
import { databaseService } from '../services/databaseService';
import { getAgentById } from '../data/agents';

// ── Lightweight Markdown Renderer ────────────────────────────────────────────
// Renders: **bold**, `code`, ### headers, bullet lines (•  - *), numbered lists
const MarkdownText = ({ text }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // H3 header
    if (line.startsWith('### ')) {
      elements.push(
        <div key={key++} className="font-bold text-gray-900 mt-3 mb-1 text-sm">
          {renderInline(line.slice(4))}
        </div>
      );
    }
    // H2 header
    else if (line.startsWith('## ')) {
      elements.push(
        <div key={key++} className="font-bold text-gray-900 mt-3 mb-1">
          {renderInline(line.slice(3))}
        </div>
      );
    }
    // Bullet / list line
    else if (/^[\s]*[-•*]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      elements.push(
        <div key={key++} className="flex gap-2 my-0.5 ml-2">
          <span className="text-gray-400 flex-shrink-0 mt-0.5">›</span>
          <span>{renderInline(line.replace(/^[\s]*[-•*]\s/, '').replace(/^\s*\d+\.\s/, ''))}</span>
        </div>
      );
    }
    // Horizontal rule
    else if (line.trim() === '---') {
      elements.push(<hr key={key++} className="my-2 border-gray-200" />);
    }
    // Empty line → spacing
    else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1" />);
    }
    // Normal paragraph
    else {
      elements.push(
        <div key={key++} className="my-0.5 leading-relaxed">
          {renderInline(line)}
        </div>
      );
    }
  }
  return <div className="text-sm space-y-0.5">{elements}</div>;
};

// Render inline: **bold** and `code`
const renderInline = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

// ── Main Component ────────────────────────────────────────────────────────────
export const AgentChat = ({ agentId, onBack, masterContext, initialMessages, onMessagesUpdate }) => {
  const [messages, setMessages] = useState(initialMessages || []);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [agent, setAgent] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [previewUrls, setPreviewUrls] = useState({});
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Init agent + load chat history ──────────────────────────────────────────
  useEffect(() => {
    const selectedAgent = getAgentById(agentId);
    setAgent(selectedAgent);

    if (selectedAgent && (!initialMessages || initialMessages.length === 0)) {
      // Greeting message
      const greeting = {
        id: Date.now(),
        sender: 'agent',
        text: `สวัสดีค่ะ! ฉันคือ **${selectedAgent.name}** ${selectedAgent.emoji}\n\n${selectedAgent.description}\n\nบอกได้เลยค่ะ ต้องการให้ช่วยเรื่องอะไร?`,
        timestamp: new Date(),
        confidence: 100,
      };
      setMessages([greeting]);

      // Load history from Neon (non-blocking, safe)
      loadChatHistory(selectedAgent);
    }

    // Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'th-TH';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) setInputValue(transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, [agentId]);

  // ── Load chat history safely ─────────────────────────────────────────────
  const loadChatHistory = async (selectedAgent) => {
    try {
      if (!masterContext?.brandId) return;
      const brandId = masterContext.brandId;
      // Fetch history for any brandId (now supporting string/guest IDs)

      const history = await databaseService.getConversationHistory(String(brandId), 20);

      if (history && history.length > 0) {
        const historyMessages = history.map((msg, idx) => ({
          id: idx + 100,
          sender: msg.role === 'user' ? 'user' : 'agent',
          text: msg.content,
          timestamp: new Date(msg.createdAt || Date.now()),
          confidence: msg.confidence,
        }));

        setMessages(prev => [...prev, ...historyMessages]);
      }
    } catch (err) {
      // Non-fatal — just skip history load
      console.warn('[AgentChat] Could not load chat history:', err.message);
    }
  };

  // ── Sync to parent state ──────────────────────────────────────────────────
  useEffect(() => {
    if (onMessagesUpdate && messages.length > 0) {
      onMessagesUpdate(messages);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Speech toggle ────────────────────────────────────────────────────────
  const handleSpeechToggle = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setInputValue('');
      recognitionRef.current.start();
    }
  };

  // ── File handling ────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`ไฟล์ ${file.name} ใหญ่เกินไป (สูงสุด 10MB)`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachments(prev => [...prev, {
          name: file.name, type: file.type, size: file.size, data: event.target?.result,
        }]);
        if (file.type.startsWith('image/')) {
          setPreviewUrls(prev => ({ ...prev, [file.name]: event.target?.result }));
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (fileName) => {
    setAttachments(prev => prev.filter(f => f.name !== fileName));
    setPreviewUrls(prev => { const n = { ...prev }; delete n[fileName]; return n; });
  };

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSendMessage = async (e) => {
    console.log('[AgentChat] handleSendMessage triggered');
    e.preventDefault();
    if (!inputValue.trim() && attachments.length === 0) {
      console.log('[AgentChat] Empty message, returning');
      return;
    }

    setError(null);
    const userText = inputValue || `[แนบไฟล์: ${attachments.map(a => a.name).join(', ')}]`;

    setMessages(prev => [...prev, {
      id: Date.now(),
      sender: 'user',
      text: userText,
      timestamp: new Date(),
      attachments: attachments.map(a => ({ name: a.name, type: a.type, size: a.size })),
    }]);
    setInputValue('');
    setAttachments([]);
    setPreviewUrls({});
    setIsLoading(true);

    try {
      console.log('[AgentChat] Calling aiService.processMessage');
      const response = await aiService.processMessage({
        userInput: userText,
        context: masterContext,
        forceAgent: agentId,
        attachments,
      });
      console.log('[AgentChat] Received response:', response);

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'agent',
        text: response.content,
        timestamp: new Date(),
        confidence: response.confidence,
        agentName: response.agentName,
        factCheckResult: response.factCheckResult,
      }]);
    } catch (err) {
      console.error('[AgentChat] Send error:', err);
      // Error boundary — show in chat, don't crash
      const msg = err?.message?.includes('401')
        ? '⚠️ API Key ไม่ถูกต้อง กรุณาตรวจสอบ ANTHROPIC_API_KEY ใน .env'
        : err?.message?.includes('fetch')
          ? '⚠️ เชื่อมต่อ API ไม่ได้ กรุณาลอง reload'
          : `⚠️ ${err.message || 'เกิดข้อผิดพลาด'}`;

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'agent',
        text: msg,
        timestamp: new Date(),
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Animations ───────────────────────────────────────────────────────────
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
  };
  const messageVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  };

  // ── Notice for missing context ──────────────────────────────────────────
  const NoContextNotice = () => (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-700 text-xs font-sarabun">
      <AlertCircle className="w-3.5 h-3.5" />
      <span>คุณยังไม่ได้ตั้งค่าแบรนด์ หากใช้งานตอนนี้ ข้อมูลบางอย่างอาจต้องกรอกซ้ำเมื่อเปลี่ยน Agent</span>
      <button
        onClick={() => window.location.hash = '#onboarding'}
        className="ml-auto underline font-bold"
      >
        ตั้งค่าตอนนี้
      </button>
    </div>
  );

  // ── No agent guard ───────────────────────────────────────────────────────
  if (agent === null && agentId) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <RefreshCw className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
          <p className="text-gray-500 font-sarabun">กำลังโหลด Agent...</p>
        </div>
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <Container size="lg">
          <div className="flex items-center gap-3 py-3">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Agent info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                {agent?.emoji || '🤖'}
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-gray-900 font-sarabun truncate">
                  {agent?.name || 'Agent'}
                </h1>
                <p className="text-xs text-gray-400 font-sarabun truncate">
                  {agent?.cluster?.toUpperCase()} · Engine Online
                </p>
              </div>
            </div>

            {/* Brand badge */}
            <div className="flex-shrink-0 hidden sm:flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: masterContext?.visualStyle?.primaryColor || '#5E9BEB' }}
              />
              <span className="text-xs font-medium text-blue-700 font-sarabun">
                {masterContext?.brandNameTh || 'Your Brand'}
              </span>
            </div>
          </div>
        </Container>
      </div>

      {/* Context Notice */}
      {(!masterContext || masterContext.isDefault) && <NoContextNotice />}

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 flex-shrink-0">
          <Container size="lg">
            <div className="flex items-center gap-2 py-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 font-sarabun flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </Container>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <Container size="lg">
          <div className="py-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-20 text-gray-400 font-sarabun">
                กรุณารอสักครู่ กำลังเริ่มต้นการสนทนา...
              </div>
            )}
            {messages.map((message) => (
              <motion.div
                key={message.id}
                variants={messageVariants}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2.5 max-w-[85%] sm:max-w-[75%] ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>

                  {/* Avatar */}
                  {message.sender === 'agent' && (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 mt-1 ${message.isError ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                      {message.isError ? '⚠️' : (agent?.emoji || '🤖')}
                    </div>
                  )}

                  {/* Bubble */}
                  <div className={`rounded-2xl px-4 py-3 ${message.isError
                    ? 'bg-red-50 border border-red-200 text-red-800 rounded-bl-sm'
                    : message.sender === 'user'
                      ? 'bg-[#5E9BEB] text-white rounded-br-sm'
                      : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-bl-sm'
                    }`}>
                    {message.sender === 'user' ? (
                      <p className="text-sm font-sarabun whitespace-pre-wrap">{message.text}</p>
                    ) : (
                      <MarkdownText text={message.text} />
                    )}

                    {/* Meta */}
                    <div className={`text-xs mt-2 flex flex-wrap gap-2 ${message.sender === 'user' ? 'text-blue-100 justify-end' : 'text-gray-400'
                      }`}>
                      <span>
                        {(message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp))
                          .toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {message.confidence && message.confidence < 100 && (
                        <span>🎯 {message.confidence <= 1 ? Math.round(message.confidence * 100) : message.confidence}%</span>
                      )}
                      {message.factCheckResult?.valid === false && (
                        <span className="text-yellow-500">⚠️ ตรวจสอบข้อมูล</span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <motion.div variants={messageVariants} className="flex justify-start">
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-base flex-shrink-0">
                    {agent?.emoji || '🤖'}
                  </div>
                  <div className="bg-white border border-gray-100 shadow-sm px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1 items-center h-5">
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay }}
                          className="w-2 h-2 bg-blue-400 rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </Container>
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 flex-shrink-0">
        <Container size="lg">

          {/* Attachment preview */}
          {attachments.length > 0 && (
            <div className="pt-3 pb-1 flex flex-wrap gap-2">
              {attachments.map(att => (
                <div key={att.name} className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-lg text-xs">
                  {att.type.startsWith('image/') ? (
                    <img src={previewUrls[att.name]} alt={att.name} className="w-8 h-8 object-cover rounded" />
                  ) : (
                    <Paperclip className="w-3 h-3 text-gray-500" />
                  )}
                  <span className="text-gray-600 max-w-[100px] truncate font-sarabun">{att.name}</span>
                  <button onClick={() => removeAttachment(att.name)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="py-3 flex items-end gap-2">

            {/* File attach */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors flex-shrink-0"
              title="แนบไฟล์"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.txt,.doc,.docx"
            />

            {/* Voice */}
            {speechSupported && (
              <button
                type="button"
                onClick={handleSpeechToggle}
                disabled={isLoading}
                className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}
                title={isListening ? 'หยุดฟัง' : 'พูดข้อความ'}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            {/* Text input */}
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              disabled={isLoading}
              rows={1}
              placeholder={`บอก ${agent?.name || 'Agent'} ว่าต้องการอะไร...`}
              className="flex-1 resize-none bg-gray-100 hover:bg-gray-50 focus:bg-white border border-transparent focus:border-blue-300 rounded-xl px-4 py-2.5 text-sm font-sarabun outline-none transition-all max-h-32"
              style={{ lineHeight: '1.5' }}
            />

            {/* Send */}
            <motion.button
              type="submit"
              disabled={isLoading || (!inputValue.trim() && attachments.length === 0)}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 bg-[#5E9BEB] hover:bg-[#4A7BC9] disabled:bg-gray-200 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          </form>
        </Container>
      </div>
    </div>
  );
};

export default AgentChat;
