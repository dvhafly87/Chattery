import { getDatabase, ref, set, onDisconnect } from "firebase/database"

const registerOnlineUser = (nickname) => {
    const db = getDatabase();
    const userRef = ref(db,  `onlineUsers/${nickname}`);

    //현재 세션 시간 저장
    set(userRef, {
        timestamp: Date.now()
    });

    //세션 종료 프로세스
    onDisconnect(userRef).remove();
}

export default registerOnlineUser;