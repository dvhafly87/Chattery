import React, { useState } from "react";
import '../ChatMain.css';


function GoChatMain() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const handleSend = () => {
    if (message.trim() === "") return;  // 빈 메시지 무시

    setMessages([...messages, message]);
    setMessage("");  // 입력창 초기화
  };

  return (
    <div className="Chat-Main-Container">
      <div className="Chat-Show-Container" style={{ border: "1px solid #ccc", height: "300px", overflowY: "auto", padding: "10px" }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: "5px" }}>
            {msg}
          </div>
        ))}
      </div>
      <div>
        <input
          placeholder="메시지 입력"
          autoComplete="off"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if(e.key === 'Enter') handleSend(); }}
          style={{ width: "70%", marginRight: "10px" }}
        />
        <button onClick={handleSend}>입력</button>
      </div>
    </div>
  );
}

export default GoChatMain;
