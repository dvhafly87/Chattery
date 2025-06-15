import React, { useState, useEffect } from "react";
import { getDatabase, ref, push, onChildAdded, get, onValue, onDisconnect, remove} from "firebase/database";
import { useLocation } from "react-router-dom";
import "../ChatMain.css";

function ChatMain() {
  const location = useLocation();
  const { nickname = "익명", roomId = "default_room" } = location.state || {};

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const db = getDatabase();
    const messagesRef = ref(db, `chat/rooms/${roomId}/messages`);

    // 실시간 메시지 추가 감지
    onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const messagesList = Object.values(data);
      setMessages(messagesList);
    }
  });
  //삭제 프로세스
    const roomRef = ref(db, `chat/rooms/${roomId}`);
    onDisconnect(roomRef).remove();

    return () => {
      remove(roomRef);
    };
  }, [roomId]);

  const handleSend = async () => {
    if (message.trim() === "") return;

    const db = getDatabase();
    const messagesRef = ref(db, `chatRooms/${roomId}`);

    const snapshot = await get(messagesRef);

    if (!snapshot.exists()) {
      alert("아직 상대가 연결되지 않았습니다. 기다려 주세요!");
      return;
    }

    push(messagesRef, {
      sender: nickname,
      text: message,
      timestamp: Date.now(),
    });

    setMessage("");
  };

  return (
    <div className="Chat-Main-Container">
      <div
        className="Chat-Show-Container"
        style={{ border: "1px solid #ccc", height: "300px", overflowY: "auto", padding: "10px" }}
      >
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: "5px" }}>
            <strong>{msg.sender}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <div>
        <input
          placeholder="메시지 입력"
          autoComplete="off"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          style={{ width: "70%", marginRight: "10px" }}
        />
        <button onClick={handleSend}>입력</button>
      </div>
    </div>
  );
}

export default ChatMain;
