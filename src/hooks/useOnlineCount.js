// src/hooks/useOnlineCount.js
import { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";

export default function useOnlineCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const db = getDatabase();
    const usersRef = ref(db, "UsersConnection");
    const unsubscribe = onValue(usersRef, (snapshot) => {
      let online = 0;
      snapshot.forEach(child => {
        if (child.val().connection === true) online += 1;
      });
      setCount(online);
    });
    return () => unsubscribe();
  }, []);

  return count;
}
