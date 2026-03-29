import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../services/firebase/config';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { database } from '../services/firebase/config';
import { ref, get } from 'firebase/database';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  async function login(email, password) {
    try {
      await setPersistence(auth, browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Lấy role của user từ Realtime Database
      const userRoleRef = ref(database, `users/${user.uid}/role`);
      const snapshot = await get(userRoleRef);
      
      if (snapshot.exists()) {
        setUserRole(snapshot.val());
        return { success: true, role: snapshot.val() };
      } else {
        await signOut(auth);
        return { success: false, error: 'Không tìm thấy vai trò người dùng' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRoleRef = ref(database, `users/${user.uid}/role`);
        const snapshot = await get(userRoleRef);
        if (snapshot.exists()) {
          setUserRole(snapshot.val());
        }
      } else {
        setUserRole(null);
      }
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
} 
