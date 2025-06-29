import React, { useState, useEffect, useRef } from "react";
import { getDatabase, ref, remove, push } from "firebase/database";
import { auth, apiKey } from "../firebase/firebase";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";

function ChatWithLlama3() {
    const location = useLocation();
    const navigate = useNavigate();

    //유저 정보/방 정보
    const { nickname, roomId } = location.state || {};

    const [userInput, setUserInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isTranslationEnabled, setIsTranslationEnabled] = useState(true);
    const chatMessagesRef = useRef(null);
    const inputRef = useRef(null);

    // 새 메시지가 추가될 때마다 스크롤을 맨 아래로
    useEffect(() => {
        if (chatMessagesRef.current) {
            chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
        }
    }, [messages]);

    const OutRoom = async () => {
        if (window.confirm("나가시겠습니까?")) {

            const db = getDatabase();
            const AiRef = ref(db, `waitingRooms/${roomId}`)
            const AiUse = ref(db, `onlineUsers/${nickname}`)

            try {
                // AI 세션 삭제 프로세스
                setTimeout(async () => {
                    try {
                        await remove(AiRef);
                        await remove(AiUse);

                        console.log("채팅방이 삭제되었습니다.");

                        navigate("/Chattery");
                    } catch (error) {
                        console.error("채팅방 삭제 중 오류 발생:", error);
                        alert("삭제 실패. 콘솔을 확인하세요.");
                    }
                }, 1500); // 1.5초 후 삭제

            } catch (error) {
                console.error("퇴장 메시지 전송 실패:", error);
            }
        }
    };

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
            const res = await fetch("https://dvhafly87.kmgproj.p-e.kr:3339/api/generate", {
                method: "POST",
                mode: 'cors',
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

            async function translateText(text) {
                const apiKey = "AIzaSyDnBk4zgG-J7tklh63ZvdghkHJQB98Okv8";

                // 문단 구분을 위해 줄바꿈을 특별한 마커로 대체
                const textWithMarkers = text
                    .replace(/\n\n/g, ' [PARAGRAPH_BREAK] ')
                    .replace(/\n/g, ' [LINE_BREAK] ');

                const url = `https://translation.googleapis.com/language/translate/v2?q=${encodeURIComponent(textWithMarkers)}&target=ko&key=${apiKey}`;

                const response = await fetch(url);
                const data = await response.json();
                let translatedText = data.data.translations[0].translatedText;

                // HTML 엔티티 디코딩
                translatedText = translatedText
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&nbsp;/g, ' ');

                // 마커를 다시 줄바꿈으로 복원
                translatedText = translatedText
                    .replace(/\[PARAGRAPH_BREAK\]/g, '\n\n')
                    .replace(/\[LINE_BREAK\]/g, '\n');

                return translatedText;
            }

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    let finalResponse = fullResponse;

                    // 원문과 번역문을 모두 저장
                    let translatedResponse = fullResponse;
                    if (isTranslationEnabled) {
                        try {
                            translatedResponse = await translateText(fullResponse);
                        } catch (error) {
                            console.error("번역 실패:", error);
                            // 번역 실패 시 원본 텍스트 유지
                        }
                    }

                    setMessages(prev => {
                        const newMessages = [...prev];
                        newMessages[aiMessageIndex] = {
                            ...newMessages[aiMessageIndex],
                            originalContent: fullResponse, // 원문 저장
                            translatedContent: translatedResponse, // 번역문 저장
                            content: isTranslationEnabled ? translatedResponse : fullResponse, // 현재 표시할 내용
                            isStreaming: false
                        };
                        return newMessages;
                    });

                    break;
                }

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n").filter(line => line.trim() !== "");

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);

                        if (json.response) {
                            fullResponse += json.response;
                            // 실시간으로 AI 응답 표시 (번역 전 원본)
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

    const toggleTranslation = () => {
        setIsTranslationEnabled(!isTranslationEnabled);

        // 기존 AI 메시지들의 표시 내용을 토글 상태에 따라 업데이트
        setMessages(prev => prev.map(message => {
            if (message.type === 'ai' && message.originalContent) {
                return {
                    ...message,
                    content: !isTranslationEnabled ?
                        (message.translatedContent || message.originalContent) :
                        message.originalContent
                };
            }
            return message;
        }));
    };

    return (
        <>
            <div className="chat-container">
                {/* 헤더 */}
                <div className="chat-header">
                    <h1>Llama3</h1>
                    <div className="subtitle">Llama3_8B</div>
                    <div className="BackButton">
                        <button onClick={OutRoom}>버튼</button>
                    </div>
                    {/* 번역 토글 */}
                    <div className="translation-toggle">
                        <span className="translation-toggle-label">🌐 번역</span>
                        <div
                            className={`toggle-switch ${isTranslationEnabled ? 'active' : ''}`}
                            onClick={toggleTranslation}
                        >
                            <div className="toggle-slider"></div>
                        </div>
                    </div>
                </div>

                {/* 채팅 메시지 영역 */}
                <div className="chat-messages" ref={chatMessagesRef}>
                    {messages.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">💬</div>
                            <h3>안녕하세요!</h3>
                            <p>Llama3와 채팅을 시작해보세요.<br />궁금한 것이 있으면 언제든 물어보세요!</p>
                            <p style={{ marginTop: '10px', fontSize: '14px', opacity: '0.7' }}>
                                {isTranslationEnabled ? '번역 활성화됨' : '번역 비활성화됨'}
                            </p>
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
                                        <span>
                                            AI가 응답을 생성하고 있습니다...
                                        </span>
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
                            placeholder={`메시지를 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)${isTranslationEnabled ? ' - 번역 활성화됨' : ' - 번역 비활성화됨'}`}
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