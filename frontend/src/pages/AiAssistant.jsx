import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, RefreshCw, AlertCircle, Calendar, 
  Wallet, Clock, Footprints, MessageSquare, Check, Sparkles,
  Mic, MicOff, Volume2, VolumeX, X, CircleDot, Headphones
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

  // Conversational Voice Mode States
  const [isConversationalMode, setIsConversationalMode] = useState(false);
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking'
  const [isMuted, setIsMuted] = useState(false);

  // Refs to avoid closure-stale states in event callbacks
  const isConversationalModeRef = useRef(isConversationalMode);
  const voiceStateRef = useRef(voiceState);
  const isMutedRef = useRef(isMuted);

  useEffect(() => { isConversationalModeRef.current = isConversationalMode; }, [isConversationalMode]);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // Standard Voice Recognition state (for regular push-to-talk button)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Strip markdown formatting for Speech Synthesis
  const stripMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/-\s+/g, '')
      .replace(/#+\s+/g, '')
      .replace(/[`_]/g, '')
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, ''); // Emojis
  };

  const startRecognitionSafely = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.log("Speech recognition already running:", e.message);
    }
  };

  // Text-To-Speech Narration
  const speakText = (text) => {
    window.speechSynthesis.cancel(); // Stop active speaking

    const cleanedText = stripMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(cleanedText);

    // Pick a natural human voice
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => 
      v.lang.startsWith('en') && 
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft') || v.name.includes('Samantha'))
    );
    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (isConversationalModeRef.current) {
        setVoiceState('listening');
        startRecognitionSafely();
      }
    };

    utterance.onerror = (e) => {
      console.error("Speech Synthesis Error:", e);
      if (isConversationalModeRef.current) {
        setVoiceState('listening');
        startRecognitionSafely();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Web Speech Recognition Config
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        if (isConversationalModeRef.current) {
          setVoiceState('listening');
        }
      };

      rec.onend = () => {
        setIsListening(false);
        // Automatically restart listening in conversational mode if still active
        if (isConversationalModeRef.current && voiceStateRef.current === 'listening') {
          startRecognitionSafely();
        }
      };

      rec.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (isConversationalModeRef.current) {
          setVoiceState('processing');
          handleSendVoiceMessage(transcript);
        } else {
          setInputText(prev => prev + (prev ? ' ' : '') + transcript);
        }
      };

      rec.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
          alert("Microphone access was denied. Please allow microphone permissions in your browser settings!");
          handleExitVoiceMode();
        } else if (event.error === 'no-speech') {
          console.log("No speech detected.");
        } else {
          if (isConversationalModeRef.current) {
            setTimeout(() => {
              if (voiceStateRef.current === 'listening') {
                startRecognitionSafely();
              }
            }, 1000);
          }
        }
      };

      recognitionRef.current = rec;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Voice recognition is not supported in this browser. Please try Google Chrome or Safari!");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const handleInterruptSpeech = () => {
    window.speechSynthesis.cancel();
    if (isConversationalMode) {
      setVoiceState('listening');
      startRecognitionSafely();
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      window.speechSynthesis.cancel();
      if (voiceState === 'speaking') {
        setVoiceState('listening');
        startRecognitionSafely();
      }
    } else {
      if (isConversationalMode && voiceState === 'listening') {
        startRecognitionSafely();
      }
    }
  };

  const handleStartVoiceMode = () => {
    setIsConversationalMode(true);
    setVoiceState('listening');
    window.speechSynthesis.cancel();
    setTimeout(() => {
      startRecognitionSafely();
    }, 200);
  };

  const handleExitVoiceMode = () => {
    setIsConversationalMode(false);
    setVoiceState('idle');
    window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

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

    if (text === '__voice_mode__') {
      handleStartVoiceMode();
      if (!textToSend) setInputText('');
      return;
    }

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
        body: JSON.stringify({ 
          message: text, 
          clientDate, 
          timezoneOffset: new Date().getTimezoneOffset() 
        })
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

  const handleSendVoiceMessage = async (text) => {
    if (!text.trim()) {
      setVoiceState('listening');
      startRecognitionSafely();
      return;
    }

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
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          message: text, 
          clientDate, 
          timezoneOffset: new Date().getTimezoneOffset() 
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        // 2. Add Agent Message
        const agentMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: data.reply,
          timestamp: new Date(),
          actionExecuted: data.executed,
          actionDetails: data.actionDetails
        };
        setMessages(prev => [...prev, agentMessage]);

        // 3. Play Text-to-Speech response if not muted
        if (!isMutedRef.current) {
          setVoiceState('speaking');
          speakText(data.reply);
        } else {
          setVoiceState('listening');
          startRecognitionSafely();
        }
      } else {
        const errData = await res.json();
        const errMsg = `Sorry, I encountered an error: ${errData.message || 'Unknown backend error'}`;
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: 'agent',
          text: errMsg,
          timestamp: new Date()
        }]);
        if (!isMutedRef.current) {
          setVoiceState('speaking');
          speakText(errMsg);
        } else {
          setVoiceState('listening');
          startRecognitionSafely();
        }
      }
    } catch (err) {
      console.error(err);
      const connMsg = "Sorry, I am unable to connect to the backend agent service right now.";
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: connMsg,
        timestamp: new Date()
      }]);
      if (!isMutedRef.current) {
        setVoiceState('speaking');
        speakText(connMsg);
      } else {
        setVoiceState('listening');
        startRecognitionSafely();
      }
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
  };  const suggestionChips = [
    { label: "🎙️ Talk to AI (Voice)", action: "__voice_mode__" },
    { label: "spent 150 on Food", action: "log ₹150 for Food for Lunch" },
    { label: "start Coding session", action: "start Coding session" },
    { label: "stop work timer", action: "stop work session" },
    { label: "check me in to office", action: "check me in" },
    { label: "how was my day today?", action: "summary" },
  ];

  const styles = `
    @keyframes pulse-ring {
      0% { transform: scale(0.98); opacity: 0.6; }
      50% { transform: scale(1.08); opacity: 0.9; }
      100% { transform: scale(0.98); opacity: 0.6; }
    }
    @keyframes bar-bounce {
      0%, 100% { transform: scaleY(0.3); }
      50% { transform: scaleY(1); }
    }
    @keyframes spin-loader {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .pulse-animation {
      animation: pulse-ring 2.2s infinite ease-in-out;
    }
    .bounce-1 { animation: bar-bounce 1s infinite ease-in-out; }
    .bounce-2 { animation: bar-bounce 1.2s infinite ease-in-out 0.2s; }
    .bounce-3 { animation: bar-bounce 0.8s infinite ease-in-out 0.4s; }
    .bounce-4 { animation: bar-bounce 1.1s infinite ease-in-out 0.1s; }
    .bounce-5 { animation: bar-bounce 0.9s infinite ease-in-out 0.3s; }
  `;

  return (
    <div className="main-content" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4.5rem)', paddingBottom: '1rem', backgroundColor: 'var(--bg-primary)' }}>
      <style>{styles}</style>
      
      {isConversationalMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
          {/* Voice Mode Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '0.5rem', borderRadius: '12px' }}>
                <Headphones size={24} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Voice Mode</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Continuous hands-free conversation
                </span>
              </div>
            </div>
            <button 
              onClick={handleExitVoiceMode}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
            >
              <X size={14} /> Exit
            </button>
          </div>

          {/* Voice Visualization Card */}
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            boxShadow: 'var(--shadow)',
            position: 'relative',
            overflow: 'hidden',
            minHeight: '260px'
          }}>
            {/* Animated Ring Indicator based on state */}
            <div 
              onClick={voiceState === 'speaking' ? handleInterruptSpeech : undefined}
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: voiceState === 'speaking' ? 'pointer' : 'default',
                position: 'relative',
                transition: 'all 0.3s ease',
                backgroundColor: 
                  voiceState === 'listening' ? 'rgba(52, 199, 89, 0.1)' :
                  voiceState === 'processing' ? 'rgba(139, 92, 246, 0.1)' :
                  voiceState === 'speaking' ? 'rgba(255, 149, 0, 0.1)' : 'var(--bg-tertiary)',
                border: 
                  voiceState === 'listening' ? '2px solid #34c759' :
                  voiceState === 'processing' ? '2px solid var(--primary)' :
                  voiceState === 'speaking' ? '2px solid #ff9500' : '2px solid var(--border)',
                boxShadow: 
                  voiceState === 'listening' ? '0 0 20px rgba(52, 199, 89, 0.3)' :
                  voiceState === 'processing' ? '0 0 20px rgba(139, 92, 246, 0.3)' :
                  voiceState === 'speaking' ? '0 0 20px rgba(255, 149, 0, 0.3)' : 'none'
              }}
              className={voiceState === 'listening' ? 'pulse-animation' : ''}
              title={voiceState === 'speaking' ? 'Tap to interrupt AI' : ''}
            >
              {/* Spinning/Animating icon inside circle */}
              {voiceState === 'listening' && <Mic size={40} style={{ color: '#34c759' }} />}
              {voiceState === 'processing' && (
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid var(--border)',
                  borderTop: '4px solid var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin-loader 1s infinite linear'
                }} />
              )}
              {voiceState === 'speaking' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px' }}>
                  <div className="bounce-1" style={{ width: '4px', height: '24px', backgroundColor: '#ff9500', borderRadius: '2px', transformOrigin: 'center' }} />
                  <div className="bounce-2" style={{ width: '4px', height: '32px', backgroundColor: '#ff9500', borderRadius: '2px', transformOrigin: 'center' }} />
                  <div className="bounce-3" style={{ width: '4px', height: '16px', backgroundColor: '#ff9500', borderRadius: '2px', transformOrigin: 'center' }} />
                  <div className="bounce-4" style={{ width: '4px', height: '28px', backgroundColor: '#ff9500', borderRadius: '2px', transformOrigin: 'center' }} />
                  <div className="bounce-5" style={{ width: '4px', height: '20px', backgroundColor: '#ff9500', borderRadius: '2px', transformOrigin: 'center' }} />
                </div>
              )}
              {voiceState === 'idle' && <MicOff size={40} style={{ color: 'var(--text-secondary)' }} />}
            </div>

            {/* State status text label */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                textTransform: 'capitalize',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem'
              }}>
                <CircleDot size={14} style={{
                  color: 
                    voiceState === 'listening' ? '#34c759' :
                    voiceState === 'processing' ? 'var(--primary)' :
                    voiceState === 'speaking' ? '#ff9500' : 'var(--text-muted)'
                }} />
                {voiceState === 'listening' && 'Listening to you...'}
                {voiceState === 'processing' && 'Thinking...'}
                {voiceState === 'speaking' && 'Speaking...'}
                {voiceState === 'idle' && 'Idle'}
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                {voiceState === 'listening' && 'Go ahead, ask me a question or speak a command.'}
                {voiceState === 'processing' && 'Querying database and creating response...'}
                {voiceState === 'speaking' && 'Tap the wave visualizer or screen to interrupt.'}
                {voiceState === 'idle' && 'Voice conversation paused.'}
              </span>
            </div>

            {/* Call Action Controls */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              {/* Mute button */}
              <button
                onClick={handleToggleMute}
                style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '50%',
                  border: '1px solid var(--border)',
                  backgroundColor: isMuted ? 'rgba(255, 59, 48, 0.1)' : 'var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: isMuted ? '#ff3b30' : 'var(--text-primary)',
                  transition: 'all 0.2s ease',
                  boxShadow: 'var(--shadow)'
                }}
                title={isMuted ? 'Unmute Speech Output' : 'Mute Speech Output'}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              {/* Stop / Interrupt button */}
              {voiceState === 'speaking' && (
                <button
                  onClick={handleInterruptSpeech}
                  className="btn btn-secondary"
                  style={{
                    borderRadius: '24px',
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: 'var(--shadow)'
                  }}
                >
                  <Mic size={14} /> Interrupt AI
                </button>
              )}
            </div>
          </div>

          {/* Scrolling Transcript Area */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            backgroundColor: 'var(--bg-primary)',
            padding: '1rem',
            overflow: 'hidden'
          }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Conversation Log
            </span>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              paddingRight: '0.25rem'
            }}>
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    gap: '0.25rem'
                  }}
                >
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {msg.sender === 'user' ? 'You' : 'Assistant'}
                  </span>
                  <div style={{
                    padding: '0.65rem 0.9rem',
                    borderRadius: '12px',
                    backgroundColor: msg.sender === 'user' ? 'var(--primary)' : 'var(--bg-secondary)',
                    color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    border: '1px solid var(--border)'
                  }}>
                    {renderMessageText(msg.text)}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      ) : (
        <>
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
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={handleStartVoiceMode}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px' }}
              >
                <Headphones size={13} /> Talk to AI
              </button>
              <button 
                onClick={handleClearChat}
                className="btn btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '8px' }}
              >
                Clear
              </button>
            </div>
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
                        <Check size={12} /> {msg.actionDetails || 'Action executed'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '85%' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyRules: 'center', flexShrink: 0 }}>
                    <Bot size={16} style={{ color: 'var(--primary)', margin: 'auto' }} />
                  </div>
                  <div style={{ padding: '0.75rem 1rem', borderRadius: '16px', borderTopLeftRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.9rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <RefreshCw size={14} className="animate-spin" /> Thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion Chips */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            padding: '0.35rem 0',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.action)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
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
              type="button"
              onClick={handleStartVoiceMode}
              style={{
                width: '2.75rem',
                height: '2.75rem',
                borderRadius: '50%',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                transition: 'all 0.3s ease',
                cursor: 'pointer'
              }}
              title="Start Voice Conversation"
            >
              <Mic size={16} style={{ color: 'var(--text-secondary)' }} />
            </button>
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
        </>
      )}
    </div>
  );
};

export default AiAssistant;
