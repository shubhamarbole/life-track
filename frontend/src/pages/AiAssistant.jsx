import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, RefreshCw, AlertCircle, Calendar, 
  Wallet, Clock, Footprints, MessageSquare, Check, Sparkles
} from 'lucide-react';

const AiAssistant = () => {
  const [messages, setMessages] = useState(() => {
    const saved = sessionStorage.getItem('daytrack_assistant_chat');
    return saved ? JSON.parse(saved) : [
      {
        id: 'welcome',
        sender: 'agent',
        text: "Hello! I am your **DayTrack AI Assistant**. I can help you analyze your habits, answer questions about your history (spending, steps, office hours), and log details directly.\n\nTry asking: \n- *'How much did I spend this week?'*\n- *'Log ₹150 for Food for Lunch'* \n- *'Start a Coding session'*",
        timestamp: new Date()
      }
    ];
  });
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const token = localStorage.getItem('lifetrack_token');
  const clientDate = new Date().toISOString().split('T')[0];

  // Save chat history to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('daytrack_assistant_chat', JSON.stringify(messages));
  }, [messages]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    if (!textToSend) setInputText('');

    // 1. Add User Message
    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // 2. Call backend Agent Chat API
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: text, clientDate })
      });

      if (res.ok) {
        const data = await res.json();
        
        // 3. Add Agent Message
        const agentMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: data.reply,
          timestamp: new Date(),
          actionExecuted: data.executed,
          actionDetails: data.actionDetails
        };
        
        setMessages(prev => [...prev, agentMessage]);
      } else {
        const errData = await res.json();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: `Sorry, I encountered an error: ${errData.message || 'Unknown backend error'}`,
          timestamp: new Date()
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: "Sorry, I am unable to connect to the backend agent service right now.",
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Clear chat history?')) {
      const reset = [
        {
          id: 'welcome',
          sender: 'agent',
          text: "Chat cleared. Ask me anything about your productivity and spending metrics!",
          timestamp: new Date()
        }
      ];
      setMessages(reset);
    }
  };

  // Basic Markdown Renderer for Bold and List items
  const renderMessageText = (text) => {
    if (!text) return '';
    // Format bold **text**
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Format italic *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Format bullet points
    formatted = formatted.split('\n').map((line, index) => {
      if (line.trim().startsWith('- ')) {
        return `<li key=${index} style="margin-left: 1rem; list-style-type: disc;">${line.trim().substring(2)}</li>`;
      }
      return line;
    }).join('\n');

    // Replace newlines with breaks (if not a list tag)
    const lines = formatted.split('\n').map((line, idx) => {
      if (line.startsWith('<li')) return line;
      return `${line}<br/>`;
    });

    return <div dangerouslySetInnerHTML={{ __html: lines.join('') }} />;
  };

  const suggestionChips = [
    { label: "spent 150 on Food", action: "log ₹150 for Food for Lunch" },
    { label: "start Coding session", action: "start Coding session" },
    { label: "stop work timer", action: "stop work session" },
    { label: "check me in to office", action: "check me in" },
    { label: "how was my day today?", action: "summary" },
  ];

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4.5rem)', paddingBottom: '1rem', backgroundColor: 'var(--bg-primary)' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '0.85rem',
        marginBottom: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', padding: '0.5rem', borderRadius: '12px' }}>
            <Bot size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>DayTrack AI Assistant</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Natural language logging & historical analytics
            </span>
          </div>
        </div>
        <button 
          onClick={handleClearChat}
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px' }}
        >
          Clear
        </button>
      </div>

      {/* Chat Messages Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        borderRadius: 'var(--radius-lg)'
      }}>
        {messages.map((msg) => (
          <div 
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              width: '100%'
            }}
          >
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              maxWidth: '85%',
              flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
            }}>
              {/* Avatar */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: msg.sender === 'user' ? 'var(--border)' : 'var(--primary-light)',
                color: msg.sender === 'user' ? 'var(--text-primary)' : 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '0.85rem',
                fontWeight: 700
              }}>
                {msg.sender === 'user' ? 'U' : <Bot size={16} />}
              </div>

              {/* Message Content Bubble */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '16px',
                  borderTopRightRadius: msg.sender === 'user' ? '4px' : '16px',
                  borderTopLeftRadius: msg.sender === 'agent' ? '4px' : '16px',
                  backgroundColor: msg.sender === 'user' ? 'var(--primary)' : 'var(--bg-secondary)',
                  color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                  fontSize: '0.9rem',
                  lineHeight: '1.45',
                  boxShadow: 'var(--shadow)',
                  border: '1px solid var(--border)'
                }}>
                  {renderMessageText(msg.text)}
                </div>

                {/* Successful action feedback badge */}
                {msg.actionExecuted && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    backgroundColor: 'rgba(52, 199, 89, 0.12)',
                    color: '#30d158',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    width: 'fit-content',
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    border: '1px solid rgba(52, 199, 89, 0.2)'
                  }}>
                    <Check size={12} strokeWidth={3} />
                    {msg.actionDetails || 'Action executed successfully'}
                  </div>
                )}

                <span style={{ 
                  fontSize: '0.65rem', 
                  color: 'var(--text-muted)', 
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  marginTop: '0.1rem'
                }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingLeft: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            <RefreshCw size={14} className="anim-pulse" />
            <span>AI Coach is compiling data...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto',
        padding: '0.5rem 0',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none'
      }}>
        {suggestionChips.map((chip, index) => (
          <button
            key={index}
            onClick={() => handleSendMessage(chip.action)}
            disabled={loading}
            style={{
              padding: '0.4rem 0.85rem',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '20px',
              color: 'var(--text-secondary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input area */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          borderTop: '1px solid var(--border)',
          paddingTop: '0.75rem',
          backgroundColor: 'var(--bg-primary)'
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask me a question or command..."
          style={{
            flex: 1,
            padding: '0.8rem 1.1rem',
            borderRadius: '24px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            outline: 'none'
          }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || loading}
          className="btn btn-primary"
          style={{
            width: '2.75rem',
            height: '2.75rem',
            borderRadius: '50%',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Send size={16} style={{ color: '#fff' }} />
        </button>
      </form>
    </div>
  );
};

export default AiAssistant;
