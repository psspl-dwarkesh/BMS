import { apiClient } from './apiClient';

export const authApi = {
  login: async (email, password) => {
    const { data } = await apiClient.post('/api/v1/auth/login', { email, password });
    return data;
  },
  getMe: async () => {
    const { data } = await apiClient.get('/api/v1/auth/me');
    return data;
  },
};

export const usersApi = {
  getUsers: async () => {
    const { data } = await apiClient.get('/api/v1/users/');
    return data;
  },
  createUser: async (user) => {
    const { data } = await apiClient.post('/api/v1/users/', user);
    return data;
  },
  setActive: async (userId, isActive) => {
    const { data } = await apiClient.patch(`/api/v1/users/${userId}/activate?is_active=${isActive}`);
    return data;
  },
  setPassword: async (userId, newPassword) => {
    const { data } = await apiClient.post(`/api/v1/users/${userId}/set-password`, { new_password: newPassword });
    return data;
  },
  assignDevice: async (userId, deviceId) => {
    const { data } = await apiClient.post(`/api/v1/users/${userId}/device-assignments`, { device_id: deviceId });
    return data;
  },
  unassignDevice: async (userId, deviceId) => {
    const { data } = await apiClient.delete(`/api/v1/users/${userId}/device-assignments/${deviceId}`);
    return data;
  },
};

export const devicesApi = {
  getDevices: async () => {
    const { data } = await apiClient.get('/api/v1/devices/');
    return data;
  },
  getDevice: async (id) => {
    const { data } = await apiClient.get(`/api/v1/devices/${id}`);
    return data;
  },
  createDevice: async (device) => {
    const { data } = await apiClient.post('/api/v1/devices/', device);
    return data;
  },
  updateDevice: async (id, updates) => {
    const { data } = await apiClient.patch(`/api/v1/devices/${id}`, updates);
    return data;
  },
};

export const telemetryApi = {
  getLatest: async (deviceId) => {
    const { data } = await apiClient.get(`/api/v1/devices/${deviceId}/telemetry/latest`);
    return data;
  },
  getHistory: async (deviceId, { start, end, page = 1, pageSize = 50 }) => {
    const params = new URLSearchParams({ page, page_size: pageSize });
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const { data } = await apiClient.get(`/api/v1/devices/${deviceId}/telemetry/history?${params}`);
    return data;
  },
  getHistoricalCells: async (deviceId, telemetryId) => {
    const { data } = await apiClient.get(`/api/v1/devices/${deviceId}/telemetry/${telemetryId}/cells`);
    return data;
  },
  importCsv: async (deviceId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post(`/api/v1/devices/${deviceId}/telemetry/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  }
};

export const locationApi = {
  getHistory: async (deviceId, start, end) => {
    const params = new URLSearchParams();
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    const { data } = await apiClient.get(`/api/v1/devices/${deviceId}/location/history?${params}`);
    return data;
  }
};

export const alertsApi = {
  getAlerts: async ({ deviceId, status, severity } = {}) => {
    const params = new URLSearchParams();
    if (deviceId) params.append('device_id', deviceId);
    if (status) params.append('status', status);
    if (severity) params.append('severity', severity);
    const { data } = await apiClient.get(`/api/v1/alerts/?${params}`);
    return data;
  },
  acknowledge: async (alertId) => {
    const { data } = await apiClient.post(`/api/v1/alerts/${alertId}/acknowledge`);
    return data;
  }
};

export const predictApi = {
  getRul: async (deviceId) => {
    const { data } = await apiClient.post(`/api/v1/devices/${deviceId}/predict/rul`);
    return data;
  }
};
