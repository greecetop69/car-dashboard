import axios from "axios";

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");
const baseURL = import.meta.env.DEV ? "/api" : apiUrl ? `${apiUrl}/api` : "/api";

if (typeof window !== "undefined") {
  console.info("[http] frontend origin:", window.location.origin);
  console.info("[http] api base URL:", baseURL);
}

export const api = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
});
