// API Client for Tarot Reading Portal
// Handles all communication with the backend API

import { API_URL } from '../app/config/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async request(method: string, endpoint: string, body?: any) {
    const url = `${API_URL}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text();
    const data = contentType.includes('application/json') && responseText
      ? JSON.parse(responseText)
      : null;

    if (!response.ok) {
      throw new Error(data?.error || responseText || 'API request failed');
    }

    if (!data) {
      throw new Error(`API returned a non-JSON response from ${url}`);
    }

    return data;
  }

  // Auth endpoints
  async signup(email: string, password: string, name?: string) {
    return this.request('POST', '/auth/signup', { email, password, name });
  }

  async login(email: string, password: string) {
    return this.request('POST', '/auth/login', { email, password });
  }

  async verifyToken() {
    return this.request('GET', '/auth/verify');
  }

  // Readings endpoints
  async createReading(cards: any[], interpretation?: string, title?: string) {
    return this.request('POST', '/readings', {
      cards,
      interpretation,
      title,
    });
  }

  async getReadings() {
    return this.request('GET', '/readings');
  }

  async getReading(id: number) {
    return this.request('GET', `/readings/${id}`);
  }

  async updateReading(id: number, data: any) {
    return this.request('PUT', `/readings/${id}`, data);
  }

  async deleteReading(id: number) {
    return this.request('DELETE', `/readings/${id}`);
  }

  // Users endpoints
  async getProfile() {
    return this.request('GET', '/users/profile');
  }

  async updateProfile(name: string) {
    return this.request('PUT', '/users/profile', { name });
  }

  async getPreferences() {
    return this.request('GET', '/users/preferences');
  }

  async updatePreferences(theme: string, language: string) {
    return this.request('PUT', '/users/preferences', { theme, language });
  }

  async getStats() {
    return this.request('GET', '/users/stats');
  }
}

export const apiClient = new ApiClient();
