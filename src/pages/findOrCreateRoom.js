// pages/findOrCreateRoom.js
import { getDatabase, ref, get, set, remove, push, onValue, onDisconnect } from "firebase/database";

export default async function findOrCreateRoom(sessionId, nickname) {
  const db = getDatabase();

  const waitingRef = ref(db, 'waitingRooms');
  const snapshot = await get(waitingRef);

  let roomId = null;

  if (snapshot.exists()) {
    const waitingRooms = snapshot.val();
    const availableRoom = Object.entries(waitingRooms).find(([key, room]) => {
      return room.userId !== sessionId; // 자신이 아닌 사람이 만든 방
    });

    if (availableRoom) {
      roomId = availableRoom[0];

      // 해당 방을 삭제하고 chatRooms로 이동
      await remove(ref(db, `waitingRooms/${roomId}`));

      await set(ref(db, `chatRooms/${roomId}`), {
        users: {
          [availableRoom[1].userId]: { nickname: availableRoom[1].nickname },
          [sessionId]: { nickname }
        },
        messages: []
      });

      return roomId;
    }
  }

  // 대기방이 없으면 새로운 대기방 생성
  const newRoomRef = push(waitingRef); // 자동으로 roomId 생성
  roomId = newRoomRef.key;

  await set(newRoomRef, {
    userId: sessionId,
    nickname,
    createdAt: Date.now()
  });

  onDisconnect(newRoomRef).remove();

  return roomId; // 이 사용자는 대기 상태
}
