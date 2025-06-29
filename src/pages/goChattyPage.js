import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDatabase, ref, push, onChildAdded, onValue, get, onDisconnect, remove, set } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

function ChatMain() {
  const navigate = useNavigate();
  const location = useLocation();
  const { nickname = "익명", roomId = "default_room" } = location.state || {};
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [roomDeleted, setRoomDeleted] = useState(false);
  const [loadedMessageIds, setLoadedMessageIds] = useState(new Set());

  const handleSubmit = async (e) => {
    e.preventDefault();

    const file = e.target.elements.fileInput?.files?.[0];

    if (!file) {
      alert("파일이 없습니다!");
      return;
    }

    try {
      const storage = getStorage();

      const storageReference = storageRef(storage, `chat/rooms/${roomId}/files/${Date.now()}_${file.name}`);

      await uploadBytes(storageReference, file);

      const downloadURL = await getDownloadURL(storageReference);

      const db = getDatabase();
      const messagesRef = ref(db, `chat/rooms/${roomId}/messages`);

      const fileMessage = {
        sender: nickname,
        fileUrl: downloadURL,
        fileName: file.name,
        fileType: file.type,
        timestamp: Date.now(),
      };

      await push(messagesRef, fileMessage);

      setactcss(false);
      e.target.reset();
    } catch (error) {
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
      remove(ref(db, `onlineUsers`));

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
          <div key={msg.id} style={{ marginBottom: "5px" }}>
            <strong>{msg.sender}:</strong> &nbsp;
            {msg.text && <span>{msg.text}</span>}
            {msg.fileUrl && (
              msg.fileType.startsWith("image/") ? (
                <div>
                  <img src={msg.fileUrl} alt={msg.fileName} style={{ maxWidth: 200, marginTop: 5, borderRadius: 4 }} />
                </div>
              ) : (
                <div>
                  <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">📎 {msg.fileName}</a>
                </div>
              )
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
        <input className="ImageAddedButton" placeholder="📎" type="text" onClick={imagesender} />&nbsp;
        <button className="chatMessageButton" onClick={handleSend}>입력</button>
        <button className="Chat-Exit-Button" onClick={OutRoom}>채팅 종료</button>
      </div>
      <AnimatePresence>
        {actcss && (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: "hidden" }}
          >
            <input type="file" name="fileInput" />
            <button type="submit">전송</button>
          </motion.form>
        )}

      </AnimatePresence>
    </div >
  );
}

export default ChatMain;