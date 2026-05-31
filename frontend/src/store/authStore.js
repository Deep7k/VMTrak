import { create } from 'zustand';
import api from '../api/client';

export const useAuthStore = create((set) => ({
    user: null,
    token: localStorage.getItem('token') || null,
    isAuthenticated: !!localStorage.getItem('token'),
    isLoading: true,

    login: async (username, password) => {
        try {
            const { data } = await api.post('/auth/login', { username, password });
            localStorage.setItem('token', data.accessToken);
            set({
                user: data.user,
                token: data.accessToken,
                isAuthenticated: true,
            });
            return data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    logout: async () => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('token');
            set({
                user: null,
                token: null,
                isAuthenticated: false,
            });
        }
    },

    refreshUser: async () => {
        try {
            const { data } = await api.get('/auth/me');
            set({ user: data.user });
            return data.user;
        } catch (error) {
            localStorage.removeItem('token');
            set({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
            });
            throw error;
        }
    },

    checkAuth: async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                set({ isLoading: false });
                return;
            }

            const { data } = await api.get('/auth/me');
            set({
                user: data.user,
                isAuthenticated: true,
                isLoading: false,
            });
        } catch (error) {
            localStorage.removeItem('token');
            set({
                user: null,
                token: null,
                isAuthenticated: false,
                isLoading: false,
            });
        }
    },
}));
