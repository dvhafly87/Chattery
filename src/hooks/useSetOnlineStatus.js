// src/hooks/useSetOnlineStatus.js
import { useEffect } from "react";
import { getDatabase, ref, onValue, onDisconnect, set } from "firebase/database";

function useSetOnlineStatus(sessionId) {
  useEffect(() => {
    if (!sessionId) return;
    const db = getDatabase();
    const myConnRef = ref(db, `UsersConnection/${sessionId}/connection`);
    const connectedRef = ref(db, ".info/connected");

    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        set(myConnRef, true);
        onDisconnect(myConnRef).remove();
      }
    });
  }, [sessionId]);
}

export default useSetOnlineStatus;
