import React, { useState, useEffect, useRef } from "react";

function ChatWithLlama3() {
    const [userinput, setUserInput] = useState("");
    const [messages, setMessages] = useState([]); // 채팅 메시지 상태
    const [isLoading, setIsLoading] = useState(false); // 로딩 상태
    const chatContainerRef = useRef(null);

    // 새 메시지가 추가될 때마다 스크롤을 맨 아래로
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const messageSend = async () => {
        if (!userinput.trim()) return;

        const userMessage = userinput;

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

            // AI 응답을 위한 빈 메시지 추가 (실시간 업데이트용)
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

            // 스트리밍 완료 표시
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
                content: '메시지 전송에 실패했습니다.',
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
        <div className="flex flex-col h-screen max-w-4xl mx-auto bg-gray-50">
            {/* 헤더 */}
            <div className="bg-white shadow-sm border-b p-4">
                <h1 className="text-xl font-semibold text-gray-800">Llama3 채팅</h1>
            </div>

            {/* 채팅 메시지 영역 */}
            <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
            >
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                        <p>Llama3와 채팅을 시작해보세요!</p>
                    </div>
                ) : (
                    messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.type === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : message.type === 'error'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-white text-gray-800 shadow-sm border'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap">{message.content}</p>
                                <p className={`text-xs mt-1 ${message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                                    }`}>
                                    {formatTime(message.timestamp)}
                                    {message.isStreaming && (
                                        <span className="ml-2 animate-pulse">●</span>
                                    )}
                                </p>
                            </div>
                        </div>
                    ))
                )}

                {/* 로딩 인디케이터 */}
                {isLoading && messages[messages.length - 1]?.type !== 'ai' && (
                    <div className="flex justify-start">
                        <div className="bg-white text-gray-800 shadow-sm border px-4 py-2 rounded-lg">
                            <div className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 입력 영역 */}
            <div className="bg-white border-t p-4">
                <div className="flex space-x-2">
                    <input
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="메시지를 입력하세요..."
                        name="llm3_chat_input"
                        id="llm3_chat_input"
                        value={userinput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={isLoading}
                    />
                    <button
                        className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg transition-colors"
                        onClick={messageSend}
                        disabled={isLoading || !userinput.trim()}
                    >
                        전송
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ChatWithLlama3;