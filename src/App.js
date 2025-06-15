import React, {useEffect, useState } from "react";
import { getDatabase, ref, onvalue, onDisconnect, set } from "firebase/database";
import { auth, apiKey } from "./firebase/firebase";
import { BrowserRouter,Routes, Route, useNavigate } from "react-router-dom"; 
import useSetOnlineStatus from './hooks/useSetOnlineStatus';
import useOnlineCount from './hooks/useOnlineCount';
import ChatMain from "./pages/goChattyPage";
import registerOnlineUser from './pages/registerOnlineUser';
import findOrCreateRoom from './pages/findOrCreateRoom.js';

function Home(){
  const navigate = useNavigate();
  useSetOnlineStatus();
  
  const onlineCount = useOnlineCount();
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2, 12);
    localStorage.setItem('sessionId', sessionId);
  }
  const [nickname, setNickname] = useState("");

  const goChatmainpage = async () => {

    if (nickname.trim() === "") {
      alert("닉네임을 입력해주세요!");
      return;
    }

    registerOnlineUser(nickname.trim());

    const roomId = await findOrCreateRoom(sessionId, nickname.trim());

    navigate("/ChatMain", { 
       state: { nickname, roomId }
    });
  }

  // 커스텀 훅으로 접속 상태 등록
  useSetOnlineStatus(sessionId);
    
  return (
    <div className="Main-Container">
      <div>
        <h2>현재 접속자 수: {onlineCount}명</h2>
      </div>
      <div className="Page-Title">
        Chattery
      </div>
      <div className="ProcessEnter-Container">
        <input
          className="NickNameInput"
          placeholder="채팅에 참여할 이름을 적어주세요"
          autoComplete="off"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <button className="ChatStart" onClick={goChatmainpage}>시작</button>
      </div>
    </div>
  );
}

function App() {
  return (
   <Routes>
    <Route path="/Chattery" element={<Home />}/>
    <Route path="/chatmain" element={<ChatMain />}/>
   </Routes>
  );
}

export default App;
