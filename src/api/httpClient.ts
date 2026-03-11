import axios from "axios";

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");
const baseURL = import.meta.env.DEV ? "/api" : apiUrl ? `${apiUrl}/api` : "/api";

export const api = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
});
