import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "../../lib/permissions";

export default function ProtectedRoute({ children, requiredPermission }) {
  const { currentUser, userProfile } = useAuth();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3l9.5 16.5H2.5L12 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Not Setup</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your account exists but your profile hasn't been created in the system. Contact an administrator.
          </p>
          <p className="text-xs text-gray-400 font-mono">UID: {currentUser.uid}</p>
        </div>
      </div>
    );
  }

  if (!userProfile.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 11-12.728 0" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Inactive</h2>
          <p className="text-sm text-gray-500">Your account has been deactivated. Contact an administrator.</p>
        </div>
      </div>
    );
  }

  if (requiredPermission) {
    if (!hasPermission(userProfile.role, requiredPermission)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
