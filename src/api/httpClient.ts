import axios from "axios";
import { apiBaseUrl, appConfig } from "../config/app";
import { logAuthDebug } from "../utils/authDebug";

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: appConfig.apiTimeoutMs,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const url = config.url ?? "";
  if (url.includes("/auth/")) {
    logAuthDebug("api_request", {
      method: config.method?.toUpperCase() ?? "GET",
      url,
      baseURL: config.baseURL,
      withCredentials: config.withCredentials === true,
    });
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    const url = response.config.url ?? "";
    if (url.includes("/auth/")) {
      logAuthDebug("api_response", {
        method: response.config.method?.toUpperCase() ?? "GET",
        url,
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  (error) => {
    const url = error.config?.url ?? "";
    if (url.includes("/auth/")) {
      logAuthDebug("api_error", {
        method: error.config?.method?.toUpperCase() ?? "GET",
        url,
        status: error.response?.status ?? null,
        data: error.response?.data ?? null,
        message: error.message,
      });
    }

    return Promise.reject(error);
  },
);
