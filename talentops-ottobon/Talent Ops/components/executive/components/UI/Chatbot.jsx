import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, MessageSquare, X, Move, Loader } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabaseClient';

const CHATBOT_API_URL = '/api/chatbot/query';
const SMART_BUTTONS_URL = 'http://localhost:8000/api/chatbot/context-buttons';

const Chatbot = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'ai', text: '👋 Hello! I can answer questions about company policies, projects, and documents. Ask me anything!' }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [userProfile, setUserProfile] = useState(null);
    const [smartButtons, setSmartButtons] = useState([]);
    const messagesEndRef = useRef(null);

    // Dragging state
    const [position, setPosition] = useState(() => {
        const saved = localStorage.getItem('chatbot-position');
        return saved ? JSON.parse(saved) : { bottom: 30, right: 30 };
    });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef(null);

    // Get current page context
    const location = useLocation();


    // Fetch user profile on mount
    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .single();

                    setUserProfile(profile);
                }
            } catch (error) {
                console.error('Error fetching user profile:', error);
            }
        };

        fetchUserProfile();
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // Save position to localStorage
    useEffect(() => {
        localStorage.setItem('chatbot-position', JSON.stringify(position));
    }, [position]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setInput('');
        setIsLoading(true);

        try {
            // Check if AI Gateway is running - Simplified or skipped if using direct URL
            // const healthCheck = await fetch('http://localhost:8000/health').catch(() => null);

            // if (!healthCheck || !healthCheck.ok) {
            //     setMessages(prev => [...prev, {
            //         role: 'ai',
            //         text: '⚠️ AI Gateway is not running.\n\nTo start:\n1. Open terminal in modalgateway/ai-gateway\n2. Run: python main.py\n3. Wait for "AI Gateway ready!"'
            //     }]);
            //     setIsLoading(false);
            //     return;
            // }

            // Parse @document tags from query
            let taggedDoc = null;
            let cleanQuery = userMessage;

            // Check for @tag or #tag syntax
            const tagMatch = userMessage.match(/@(\S+)|#(\S+)/);
            if (tagMatch) {
                taggedDoc = tagMatch[1] || tagMatch[2];
                // Remove tag from query for cleaner processing
                cleanQuery = userMessage.replace(/@\S+|#\S+/, '').trim();

                // Show which document is being queried
                setMessages(prev => [...prev, {
                    role: 'ai',
                    text: `🔖 Searching in document: ${taggedDoc}...`
                }]);
            }

            // Extract Project ID from URL if present
            const projectMatch = location.pathname.match(/\/projects\/([a-zA-Z0-9-]+)/);
            const projectId = projectMatch ? projectMatch[1] : null;

            // Send query to AI Gateway with RAG
            const response = await fetch(CHATBOT_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: cleanQuery || userMessage,
                    user_id: userProfile?.id,
                    org_id: userProfile?.org_id,
                    project_id: projectId,
                    context: {
                        route: location.pathname,
                        module: location.pathname.split('/').pop() || 'dashboard',
                        role: userProfile?.role || 'executive',
                        user_id: userProfile?.id || 'guest',
                        org_id: userProfile?.org_id,
                        project_id: projectId
                    },
                    tagged_doc: taggedDoc ? { document_id: taggedDoc } : null
                })
            });

            const data = await response.json();

            if (data.action === 'navigate_to_module') {
                const navMsg = data.response || data.data?.redirect_message || 'Redirecting you now...';
                setMessages(prev => [...prev, { role: 'ai', text: navMsg }]);

                if (data.data?.route && !data.data?.already_here) {
                    setTimeout(() => {
                        navigate(data.data.route);
                    }, 1000);
                }
                setIsLoading(false);
                return;
            }

            // Handle RAG response
            const responseText = data.answer || data.response;
            if (responseText) {
                let messageText = responseText;

                // Add confidence indicator
                if (data.confidence) {
                    const confidencePercent = (data.confidence * 100).toFixed(0);
                    messageText += `\n\n📊 Confidence: ${confidencePercent}%`;
                }

                // Add sources if available
                if (data.sources && data.sources.length > 0) {
                    messageText += '\n\n📚 Sources: ' + data.sources.map(s => s.title || s.document_id).join(', ');
                }

                setMessages(prev => [...prev, {
                    role: 'ai',
                    text: messageText
                }]);
            } else if (data.out_of_scope) {
                setMessages(prev => [...prev, {
                    role: 'ai',
                    text: `⚠️ Out of scope: ${data.reason || 'This question is not related to company documents or policies.'}`
                }]);
            } else {
                setMessages(prev => [...prev, {
                    role: 'ai',
                    text: data.message || 'I processed your request.'
                }]);
            }
        } catch (error) {
            console.error('Chatbot error:', error);
            setMessages(prev => [...prev, {
                role: 'ai',
                text: `❌ Error: ${error.message}\n\nMake sure the AI Gateway is running on ${CHATBOT_API_URL}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Drag handlers
    const handleMouseDown = (e) => {
        const isButton = e.target.closest('button');
        const isDragHandle = e.target.closest('.drag-handle');
        const isFAB = e.target.closest('.chatbot-fab');

        if (isButton && !isDragHandle && !isFAB) return;

        e.preventDefault();
        setIsDragging(true);
        setDragStart({
            x: e.clientX,
            y: e.clientY,
            startBottom: position.bottom,
            startRight: position.right
        });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const deltaX = dragStart.x - e.clientX;
            const deltaY = dragStart.y - e.clientY;

            const newRight = dragStart.startRight + deltaX;
            const newBottom = dragStart.startBottom + deltaY;

            const maxRight = window.innerWidth - 100;
            const maxBottom = window.innerHeight - 100;

            setPosition({
                right: Math.max(10, Math.min(maxRight, newRight)),
                bottom: Math.max(10, Math.min(maxBottom, newBottom))
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, dragStart]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'fixed',
                bottom: `${position.bottom}px`,
                right: `${position.right}px`,
                zIndex: 2000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                cursor: isDragging ? 'grabbing' : 'default',
                userSelect: isDragging ? 'none' : 'auto'
            }}
        >
            {/* Chat Window */}
            {isOpen && (
                <div style={{
                    width: '380px',
                    height: '550px',
                    backgroundColor: 'var(--surface)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-lg)',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    {/* Header */}
                    <div
                        className="drag-handle"
                        onMouseDown={handleMouseDown}
                        style={{
                            padding: '16px',
                            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: isDragging ? 'grabbing' : 'grab',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Move size={16} style={{ opacity: 0.7 }} />
                            <Bot size={20} />
                            <div>
                                <div style={{ fontWeight: 600 }}>AI Assistant</div>
                                {userProfile && (
                                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                                        {userProfile.full_name} • {userProfile.role}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                color: 'white',
                                opacity: 0.8,
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1,
                        padding: '16px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        backgroundColor: 'var(--background)'
                    }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                display: 'flex',
                                gap: '8px',
                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                            }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: msg.role === 'ai'
                                        ? 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)'
                                        : 'var(--accent)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    boxShadow: 'var(--shadow-sm)'
                                }}>
                                    {msg.role === 'ai' ? <Bot size={18} /> : <User size={18} />}
                                </div>
                                <div style={{
                                    maxWidth: '75%',
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    backgroundColor: msg.role === 'ai' ? 'var(--surface)' : 'var(--accent)',
                                    color: msg.role === 'ai' ? 'var(--text-main)' : 'white',
                                    boxShadow: 'var(--shadow-sm)',
                                    borderTopLeftRadius: msg.role === 'ai' ? '2px' : '12px',
                                    borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                }}>
                                    <p style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                                        {msg.text}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Bot size={18} />
                                </div>
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    backgroundColor: 'var(--surface)',
                                    boxShadow: 'var(--shadow-sm)',
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'center'
                                }}>
                                    <Loader size={16} className="spin" />
                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Thinking...
                                    </span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{
                        padding: '12px',
                        borderTop: '1px solid var(--border)',
                        backgroundColor: 'var(--surface)',
                        display: 'flex',
                        gap: '8px'
                    }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder="Ask me anything..."
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                outline: 'none',
                                fontSize: '0.9rem',
                                backgroundColor: 'var(--background)',
                                color: 'var(--text-main)',
                                opacity: isLoading ? 0.6 : 1
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            style={{
                                width: '44px',
                                height: '44px',
                                borderRadius: '8px',
                                background: isLoading || !input.trim()
                                    ? 'var(--border)'
                                    : 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: 'none',
                                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: isLoading || !input.trim() ? 'none' : 'var(--shadow-sm)'
                            }}
                        >
                            {isLoading ? <Loader size={18} className="spin" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Toggle Button (FAB) - Chat Enabled */}
            <button
                className="chatbot-fab"
                onMouseDown={handleMouseDown}
                onClick={() => !isDragging && setIsOpen(!isOpen)}
                style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'var(--shadow-lg)',
                    transition: isDragging ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease',
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    border: 'none',
                    userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                    if (!isDragging) {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-xl)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isDragging) {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                    }
                }}
                title="AI Chatbot"
            >
                {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
            </button>

            <style>
                {`
                    @keyframes slideIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    .drag-handle:active {
                        cursor: grabbing !important;
                    }
                    .spin {
                        animation: spin 1s linear infinite;
                    }
                `}
            </style>
        </div>
    );
};

export default Chatbot;
