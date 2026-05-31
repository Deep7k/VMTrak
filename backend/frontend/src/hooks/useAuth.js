import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
    const {
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
        refreshUser,
    } = useAuthStore();

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return {
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshUser,
    };
}
