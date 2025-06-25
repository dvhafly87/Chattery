import React, { useState, useEffect, useRef } from "react";

function ChatWithLlama3() {
    const [userInput, setUserInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const chatMessagesRef = useRef(null);
    const inputRef = useRef(null);

    // 새 메시지가 추가될 때마다 스크롤을 맨 아래로
    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [messages]);

    const messageSend = async () => {
        if (!userInput.trim()) return;

        const userMessage = userInput;

        // 사용자 메시지를 채팅에 추가
        setMessages(prev => [...prev, {
            type: 'user',
            content: userMessage,
            timestamp: new Date()
        }]);

        setUserInput("");
        setIsLoading(true);

        try {
            const res = await fetch("http://122.32.218.57:11434/api/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama3",
                    prompt: userMessage,
                    temperature: 0.7,
                    top_p: 0.9,
                    max_tokens: 200,
                    stop: ["</s>"]
                })
            });

            const reader = res.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullResponse = "";

            // AI 응답을 위한 빈 메시지 추가
            const aiMessageIndex = messages.length + 1;
            setMessages(prev => [...prev, {
                type: 'ai',
                content: '',
                timestamp: new Date(),
                isStreaming: true
            }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n").filter(line => line.trim() !== "");

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.response) {
                            fullResponse += json.response;

                            // 실시간으로 AI 응답 업데이트
                            setMessages(prev => {
                                const newMessages = [...prev];
                                newMessages[aiMessageIndex] = {
                                    ...newMessages[aiMessageIndex],
                                    content: fullResponse
                                };
                                return newMessages;
                            });
                        }
                    } catch (e) {
                        console.error("JSON 파싱 실패:", line);
                    }
                }
            }

            // 스트리밍 완료
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[aiMessageIndex] = {
                    ...newMessages[aiMessageIndex],
                    isStreaming: false
                };
                return newMessages;
            });

        } catch (error) {
            console.error("API 요청 실패:", error);
            setMessages(prev => [...prev, {
                type: 'error',
                content: '메시지 전송에 실패했습니다. 네트워크 연결을 확인해주세요.',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            messageSend();
        }
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <>
            <style jsx>{`
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                .chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    max-width: 900px;
                    margin: 0 auto;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 245, 255, 0.95) 100%);
                    backdrop-filter: blur(10px);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }

                .chat-header {
                    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                    color: white;
                    padding: 20px;
                    text-align: center;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                }

                .chat-header h1 {
                    font-size: 24px;
                    font-weight: 600;
                    margin: 0;
                }

                .chat-header .subtitle {
                    font-size: 14px;
                    opacity: 0.9;
                    margin-top: 5px;
                }

                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    background: linear-gradient(180deg, #f8f9ff 0%, #e8f0fe 100%);
                    position: relative;
                }

                .chat-messages::-webkit-scrollbar {
                    width: 6px;
                }

                .chat-messages::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 3px;
                }

                .chat-messages::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 3px;
                }

                .message-wrapper {
                    margin-bottom: 20px;
                    display: flex;
                    animation: fadeInUp 0.3s ease-out;
                }

                .message-wrapper.user {
                    justify-content: flex-end;
                }

                .message-wrapper.ai, .message-wrapper.error {
                    justify-content: flex-start;
                }

                .message-bubble {
                    max-width: 70%;
                    padding: 15px 20px;
                    border-radius: 20px;
                    position: relative;
                    word-wrap: break-word;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .message-bubble.user {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border-bottom-right-radius: 5px;
                }

                .message-bubble.ai {
                    background: white;
                    color: #333;
                    border: 1px solid #e0e0e0;
                    border-bottom-left-radius: 5px;
                }

                .message-bubble.error {
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                    color: white;
                }

                .message-content {
                    white-space: pre-wrap;
                    line-height: 1.5;
                    margin-bottom: 8px;
                }

                .message-time {
                    font-size: 11px;
                    opacity: 0.7;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }

                .streaming-indicator {
                    display: inline-flex;
                    gap: 2px;
                    margin-left: 5px;
                }

                .streaming-dot {
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background: currentColor;
                    animation: streamingPulse 1.4s infinite ease-in-out;
                }

                .streaming-dot:nth-child(1) { animation-delay: -0.32s; }
                .streaming-dot:nth-child(2) { animation-delay: -0.16s; }

                .empty-state {
                    text-align: center;
                    color: #888;
                    margin-top: 100px;
                }

                .empty-state-icon {
                    font-size: 48px;
                    margin-bottom: 20px;
                    opacity: 0.5;
                }

                .typing-indicator {
                    display: flex;
                    justify-content: flex-start;
                    margin-bottom: 20px;
                }

                .typing-bubble {
                    background: white;
                    border: 1px solid #e0e0e0;
                    border-radius: 20px;
                    border-bottom-left-radius: 5px;
                    padding: 15px 20px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                }

                .typing-dots {
                    display: flex;
                    gap: 4px;
                }

                .typing-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #ccc;
                    animation: typingBounce 1.4s infinite ease-in-out;
                }

                .typing-dot:nth-child(1) { animation-delay: -0.32s; }
                .typing-dot:nth-child(2) { animation-delay: -0.16s; }
                .typing-dot:nth-child(3) { animation-delay: 0s; }

                .chat-input-container {
                    background: white;
                    padding: 20px;
                    border-top: 1px solid #e0e0e0;
                    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
                }

                .input-wrapper {
                    display: flex;
                    gap: 12px;
                    align-items: flex-end;
                }

                .chat-input {
                    flex: 1;
                    border: 2px solid #e0e0e0;
                    border-radius: 25px;
                    padding: 12px 20px;
                    font-size: 16px;
                    resize: none;
                    outline: none;
                    transition: all 0.3s ease;
                    min-height: 50px;
                    max-height: 120px;
                    font-family: inherit;
                }

                .chat-input:focus {
                    border-color: #667eea;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
                }

                .chat-input:disabled {
                    background: #f5f5f5;
                    cursor: not-allowed;
                }

                .send-button {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    width: 50px;
                    height: 50px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                    font-size: 18px;
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
                }

                .send-button:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
                }

                .send-button:disabled {
                    background: #ccc;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes streamingPulse {
                    0%, 80%, 100% {
                        opacity: 0.3;
                        transform: scale(0.8);
                    }
                    40% {
                        opacity: 1;
                        transform: scale(1);
                    }
                }

                @keyframes typingBounce {
                    0%, 80%, 100% {
                        transform: scale(0);
                        opacity: 0.5;
                    }
                    40% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @media (max-width: 768px) {
                    .chat-container {
                        height: 100vh;
                        border-radius: 0;
                    }
                    
                    .message-bubble {
                        max-width: 85%;
                    }
                    
                    .chat-input-container {
                        padding: 15px;
                    }
                }
            `}</style>

            <div className="chat-container">
                {/* 헤더 */}
                <div className="chat-header">
                    <h1>🦙 Llama3 채팅</h1>
                    <div className="subtitle">AI와 자연스럽게 대화해보세요</div>
                </div>

                {/* 채팅 메시지 영역 */}
                <div className="chat-messages" ref={chatMessagesRef}>
                    {messages.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">💬</div>
                            <h3>안녕하세요!</h3>
                            <p>Llama3와 채팅을 시작해보세요.<br />궁금한 것이 있으면 언제든 물어보세요!</p>
                        </div>
                    ) : (
                        <>
                            {messages.map((message, index) => (
                                <div key={index} className={`message-wrapper ${message.type}`}>
                                    <div className={`message-bubble ${message.type}`}>
                                        <div className="message-content">{message.content}</div>
                                        <div className="message-time">
                                            {formatTime(message.timestamp)}
                                            {message.isStreaming && (
                                                <div className="streaming-indicator">
                                                    <div className="streaming-dot"></div>
                                                    <div className="streaming-dot"></div>
                                                    <div className="streaming-dot"></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* 타이핑 인디케이터 */}
                            {isLoading && messages[messages.length - 1]?.type !== 'ai' && (
                                <div className="typing-indicator">
                                    <div className="typing-bubble">
                                        <div className="typing-dots">
                                            <div className="typing-dot"></div>
                                            <div className="typing-dot"></div>
                                            <div className="typing-dot"></div>
                                        </div>
                                        <span>AI가 응답을 생성하고 있습니다...</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 입력 영역 */}
                <div className="chat-input-container">
                    <div className="input-wrapper">
                        <textarea
                            ref={inputRef}
                            className="chat-input"
                            placeholder="메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={isLoading}
                            rows={1}
                        />
                        <button
                            className="send-button"
                            onClick={messageSend}
                            disabled={isLoading || !userInput.trim()}
                            title="전송"
                        >
                            ➤
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default ChatWithLlama3;