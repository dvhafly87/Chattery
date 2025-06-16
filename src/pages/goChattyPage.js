import React, { useState, useEffect } from "react";
import { BrowserRouter,Routes, Route, useNavigate } from "react-router-dom";
import { getDatabase, ref, push, onChildAdded ,onValue, get, onDisconnect, remove} from "firebase/database";
import { useLocation } from "react-router-dom";


function ChatMain() {
  const navigate = useNavigate();

  const location = useLocation();
  const { nickname = "익명", roomId = "default_room" } = location.state || {};

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
  const db = getDatabase();
  const messagesRef = ref(db, `chat/rooms/${roomId}/messages`);

  // 실시간 메시지 리스닝
  onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const messagesList = Object.values(data);
      setMessages(messagesList);
    }
  });

  // 연결 종료 시 방 자동 삭제
  const roomRef = ref(db, `chat/rooms/${roomId}`);
  onDisconnect(roomRef).remove();

  return () => {
    // 언마운트 시 수동 제거
    remove(roomRef);
  };
}, [roomId]);


  const OutRoom = () => {
    if (window.confirm("정말로 채팅방에서 나가시겠습니까? 모든 데이터가 삭제됩니다.")) {
      const db = getDatabase();
      const roomRef = ref(db, `chat/rooms/${roomId}`);
      remove(roomRef)
        .then(() => {
          alert("채팅방이 삭제되었습니다.");
          navigate("/Chattery"); // React Router 방식으로 페이지 이동
        })
        .catch((error) => {
          console.error("채팅방 삭제 중 오류 발생:", error);
          alert("삭제 실패. 콘솔을 확인하세요.");
        });
    }
  };
  
  const handleSend = async () => {
    if (message.trim() === "") return;

    const db = getDatabase();
    
     const usersRef = ref(db, `chat/rooms/${roomId}/users`);
      const snapshot = await get(usersRef);

      const users = snapshot.val();
      const userCount = users ? Object.keys(users).length : 0;

      if (userCount < 2) {
        alert("아직 상대가 연결되지 않았습니다. 기다려 주세요!");
        return;
      }
      

    const messagesRef = ref(db, `chat/rooms/${roomId}/messages`);
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
        style={{ 
          border: "1px solid #ccc",
           height: "300px",
            overflowY: "auto",
             padding: "10px"
             }}
      >
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: "5px" }}>
            <strong>{msg.sender}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <div>
        <input
          className="chatMessageInput"
          placeholder="메시지 입력"
          autoComplete="off"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          style={{ width: "70%", marginRight: "10px" }}
        />
        <button className="chatMessageButton" onClick={handleSend}>입력</button>
        <button className="Chat-Exit-Button" onClick={OutRoom}>채팅 종료</button>
      </div>
    </div>
  );
}

export default ChatMain;
