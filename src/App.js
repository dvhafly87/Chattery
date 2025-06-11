import React, {useEffect, useState } from "react";
import { getDatabase, ref, onvalue, onDisconnect, set } from "firebase/database";
import { auth, apiKey } from "./firebase/firebase"; 
import useSetOnlineStatus from './hooks/useSetOnlineStatus';
import useOnlineCount from './hooks/useOnlineCount';

function App() {
  useSetOnlineStatus();
  const onlineCount = useOnlineCount();
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = Math.random().toString(36).slice(2, 12);
    localStorage.setItem('sessionId', sessionId);
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
      <input className="NickNameInput" placeholder="채팅에 참여할 이름을 적어주세요" autocomplete="off"/>
      <button className="ChatStart" onclick="chatstart()">시작</button>
    </div>
   </div>
  );
}

export default App;
