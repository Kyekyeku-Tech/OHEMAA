// src/components/PrivateRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';

export default function PrivateRoute({ children }) {
  const [user, loading] = useAuthState(auth);

  if (loading) return <div className="text-center p-8 text-white">Checking authentication...</div>;

  return user ? children : <Navigate to="/agent/login" replace />;
}