import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDatabase, ref, push, onChildAdded, onValue, get, onDisconnect, remove, set } from "firebase/database";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

function ChatMain() {
  window.onpopstate = function (event) {
    if (window.confirm("나가시겠습니까?")) {
      const db = getDatabase();
      const waitingsRoomRef = ref(db, `waitingRooms/${roomId}/`);
      const MainRoom = ref(db, `chat/rooms/${roomId}/`);
      remove(waitingsRoomRef);
      remove(MainRoom);
    }
  };
  const navigate = useNavigate();
  const location = useLocation();
  const { nickname = "익명", roomId = "default_room" } = location.state || {};
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [roomDeleted, setRoomDeleted] = useState(false);
  const [loadedMessageIds, setLoadedMessageIds] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false); // 업로드 상태 추가

  // 파일 업로드 및 메시지 전송
  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    const file = e.target.elements.fileInput?.files?.[0];

    if (!file) {
      alert("파일이 없습니다!");
      return;
    }

    // 상대방이 연결되어 있는지 확인
    const db = getDatabase();
    const onlineUsersRef = ref(db, `chat/rooms/${roomId}/users`);

    try {
      const snapshot = await get(onlineUsersRef);
      const users = snapshot.val();
      const userCount = users ? Object.keys(users).length : 0;

      if (userCount < 2) {
        alert("아직 상대가 연결되지 않았습니다. 기다려 주세요!");
        return;
      }

      setIsUploading(true);
      formData.append('fileInput', file);

      // 파일을 서버에 업로드
      const responseFU = await fetch('http://122.32.218.57:8788/upload', {
        method: 'POST',
        body: formData
      });

      const result = await responseFU.json();

      if (result.filename) {
        // 업로드 성공 시 채팅 메시지로 파일 정보 전송
        const messagesRef = ref(db, `chat/rooms/${roomId}/messages`);
        const fileMessage = {
          sender: nickname,
          text: "", // 텍스트는 비워둠
          fileName: result.filename,
          fileUrl: result.fileUrl || result.filename, // 서버에서 파일 URL 제공
          fileType: file.type,
          fileSize: file.size,
          timestamp: Date.now(),
        };

        await push(messagesRef, fileMessage);

        // 파일 전송 완료 후 폼 초기화 및 UI 닫기
        e.target.reset();
        setactcss(false);

        alert(`파일 "${result.filename}"이 전송되었습니다.`);
      } else {
        alert("파일 업로드에 실패했습니다.");
      }
    } catch (error) {
      console.error("파일 전송 실패:", error);
      alert("파일 전송 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const db = getDatabase();
    const messagesRef = ref(db, `chat/rooms/${roomId}/messages`);
    const onlineUsersRef = ref(db, `chat/rooms/${roomId}/onlineUsers`);
    const roomRef = ref(db, `chat/rooms/${roomId}`);

    //  현재 사용자를 onlineUsers에 추가
    const userKey = nickname.replace(/[.#$[\]]/g, "_"); // Firebase key 규칙에 맞게 변환
    set(ref(db, `chat/rooms/${roomId}/onlineUsers/${userKey}`), {
      nickname: nickname,
      timestamp: Date.now()
    });

    // 입장 메시지 푸시 (세션 기반 중복 방지)
    const checkAndAddEnterMessage = async () => {
      try {
        // 현재 온라인 사용자 확인
        const onlineSnapshot = await get(onlineUsersRef);
        const onlineUsers = onlineSnapshot.val();
        const isFirstUser = !onlineUsers || Object.keys(onlineUsers).length === 0;

        // 첫 번째 사용자이거나, 기존에 해당 닉네임이 온라인에 없었다면 입장 메시지 추가
        const wasUserOnline = onlineUsers && Object.values(onlineUsers).some(user => user.nickname === nickname);

        if (!wasUserOnline) {
          const enterMessage = {
            sender: "SYSTEM",
            text: `${nickname}님이 입장하셨습니다.`,
            timestamp: Date.now(),
          };
          await push(messagesRef, enterMessage);
        }

      } catch (error) {
        console.error("입장 메시지 처리 실패:", error);
      }
    };

    //입장 메시지 푸시 (간단한 중복 방지)
    setTimeout(() => {
      const enterMessage = {
        sender: "SYSTEM",
        text: `${nickname}님이 입장하셨습니다.`,
        timestamp: Date.now(),
      };
      push(messagesRef, enterMessage);
    }, 500); // 0.5초 후 입장 메시지 전송

    // 기존 메시지 한번 로드
    const loadExistingMessages = async () => {
      try {
        const snapshot = await get(messagesRef);
        const data = snapshot.val();
        if (data) {
          const messagesList = Object.entries(data).map(([id, msg]) => ({
            id,
            ...msg
          })).sort((a, b) => a.timestamp - b.timestamp);

          setMessages(messagesList);
          setLoadedMessageIds(new Set(messagesList.map(msg => msg.id)));
        }
      } catch (error) {
        console.error("기존 메시지 로드 실패:", error);
      }
    };

    // 기존 메시지 먼저 로드
    loadExistingMessages();

    //  새로운 메시지만 실시간으로 추가
    const unsubscribeMessages = onChildAdded(messagesRef, (snapshot) => {
      const messageId = snapshot.key;
      const newMessage = { id: messageId, ...snapshot.val() };

      if (newMessage && !loadedMessageIds.has(messageId)) {
        setMessages(prevMessages => {
          const updatedMessages = [...prevMessages, newMessage];
          return updatedMessages.sort((a, b) => a.timestamp - b.timestamp);
        });

        setLoadedMessageIds(prev => new Set([...prev, messageId]));
      }
    });

    //  방 전체 모니터링 - 방이 삭제되면 메인으로 이동
    const unsubscribeRoom = onValue(roomRef, (snapshot) => {
      if (!snapshot.exists() && !roomDeleted) {
        // 방이 삭제되었고, 자신이 삭제한 것이 아니라면
        alert("상대방이 채팅방을 나갔습니다. 채팅이 종료됩니다.");
        remove(ref(db, `onlineUsers/${userKey}`));
        navigate("/Chattery");
      }
    });

    //  연결이 끊어지면 해당 사용자를 onlineUsers에서 제거
    onDisconnect(ref(db, `chat/rooms/${roomId}/users/${userKey}`)).remove();

    //  브라우저 종료/새로고침 시에도 정리
    const handleBeforeUnload = () => {
      remove(ref(db, `chat/rooms/${roomId}`));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // 컴포넌트 언마운트 시 정리
      unsubscribeMessages();
      unsubscribeRoom();
      window.removeEventListener('beforeunload', handleBeforeUnload);

      // 사용자 제거
      remove(ref(db, `chat/rooms/${roomId}/onlineUsers/${userKey}`));
      remove(ref(db, `onlineUsers/${userKey}`));
    };
  }, [roomId, nickname, navigate, roomDeleted]);

  const [actcss, setactcss] = useState(false);

  const imagesender = async () => {
    setactcss(!actcss);
  }

  //세션 종료 - 개선된 버전
  const OutRoom = async () => {
    if (window.confirm("정말로 채팅방에서 나가시겠습니까? 모든 데이터가 삭제됩니다.")) {
      setRoomDeleted(true); // 자신이 방을 삭제한다는 플래그 설정

      const db = getDatabase();
      const messagesRef = ref(db, `chat/rooms/${roomId}/messages`);
      const roomRef = ref(db, `chat/rooms/${roomId}`);
      const WaitingsRoomRef = ref(db, `waitingRooms/${roomId}`);

      try {
        // 퇴장 메시지 먼저 전송
        const exitMessage = {
          sender: "SYSTEM",
          text: `${nickname}님이 퇴장하셨습니다. 채팅방이 종료됩니다.`,
          timestamp: Date.now(),
        };

        await push(messagesRef, exitMessage);

        // 잠시 후 방 전체 삭제 (상대방이 메시지를 볼 수 있도록)
        setTimeout(async () => {
          try {
            await remove(roomRef);
            await remove(WaitingsRoomRef);
            console.log("채팅방이 삭제되었습니다.");
            navigate("/Chattery");
          } catch (error) {
            console.error("채팅방 삭제 중 오류 발생:", error);
            alert("삭제 실패. 콘솔을 확인하세요.");
            setRoomDeleted(false); // 실패 시 플래그 리셋
          }
        }, 1500); // 1.5초 후 삭제

      } catch (error) {
        console.error("퇴장 메시지 전송 실패:", error);
        setRoomDeleted(false); // 실패 시 플래그 리셋
      }
    }
  };

  //세션 메시지 푸시 + 채팅 조건
  const handleSend = async () => {
    if (message.trim() === "") return;

    const db = getDatabase();
    const onlineUsersRef = ref(db, `chat/rooms/${roomId}/users`);

    try {
      const snapshot = await get(onlineUsersRef);
      const users = snapshot.val();
      const userCount = users ? Object.keys(users).length : 0;

      if (userCount < 2) {
        alert("아직 상대가 연결되지 않았습니다. 기다려 주세요!");
        return;
      }

      const messagesRef = ref(db, `chat/rooms/${roomId}/messages`);
      await push(messagesRef, {
        sender: nickname,
        text: message,
        timestamp: Date.now(),
      });
      setMessage("");
    } catch (error) {
      console.error("메시지 전송 실패:", error);
      alert("메시지 전송에 실패했습니다.");
    }
  };

  // 파일 크기를 읽기 쉽게 포맷하는 함수
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        {messages.map((msg) => (
          <div key={msg.id} style={{ marginBottom: "10px" }}>
            <strong>{msg.sender}:</strong> &nbsp;
            {msg.text && <span>{msg.text}</span>}
            {msg.fileUrl && (
              <div style={{ marginTop: "5px" }}>
                {msg.fileType && msg.fileType.startsWith("image/") ? (
                  <div>
                    <img
                      src={msg.fileUrl}
                      alt={msg.fileName}
                      style={{
                        maxWidth: 200,
                        maxHeight: 200,
                        borderRadius: 4,
                        cursor: "pointer"
                      }}
                      onClick={() => window.open(msg.fileUrl, '_blank')}
                    />
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                      {msg.fileName} ({msg.fileSize ? formatFileSize(msg.fileSize) : 'Unknown size'})
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    backgroundColor: "#f9f9f9",
                    display: "inline-block"
                  }}>
                    <a
                      href={msg.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "none" }}
                    >
                      📎 {msg.fileName}
                    </a>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                      {msg.fileSize ? formatFileSize(msg.fileSize) : 'Unknown size'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div>
        <input
          className="chatMessageInput"
          placeholder="메시지 입력..."
          autoComplete="off"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          style={{ width: "70%", marginRight: "10px" }}
        />
        <input
          className="ImageAddedButton"
          placeholder="📎"
          type="button"
          onClick={imagesender}
          disabled={isUploading}
        />&nbsp;
        <button className="chatMessageButton" onClick={handleSend}>입력</button>
        <button className="Chat-Exit-Button" onClick={OutRoom}>채팅 종료</button>
      </div>
      <AnimatePresence>
        {actcss && (
          <motion.form
            id="file-sender"
            onSubmit={handleSubmit}
            encType="multipart/form-data"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: "hidden", padding: "10px", border: "1px solid #ccc", marginTop: "5px" }}
          >
            <div>
              <input type="file" name="fileInput" required />
              <button type="submit" disabled={isUploading}>
                {isUploading ? "전송 중..." : "전송"}
              </button>
              <button type="button" onClick={() => setactcss(false)} style={{ marginLeft: "5px" }}>
                취소
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChatMain;