import axios from "axios";
import { apiBaseUrl, appConfig } from "../config/app";

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: appConfig.apiTimeoutMs,
  withCredentials: true,
});
