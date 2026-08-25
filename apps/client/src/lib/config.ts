import bytes from "bytes";
import { castToBoolean } from "@/lib/utils.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import { sanitizeUrl } from "@manadocs/editor-ext";

declare global {
  interface Window {
    CONFIG?: Record<string, string>;
  }
}

export function getAppName(): string {
  return "Manadocs";
}

export function getAppUrl(): string {
  return `${window.location.protocol}//${window.location.host}`;
}

export function getServerAppUrl(): string {
  return getConfigValue("APP_URL");
}

export function getBackendUrl(): string {
  return getAppUrl() + "/api";
}

export function getCollaborationUrl(): string {
  const baseUrl =
    getConfigValue("COLLAB_URL") ||
    (import.meta.env.DEV ? process.env.APP_URL : getAppUrl());

  const collabUrl = new URL("/collab", baseUrl);
  collabUrl.protocol = collabUrl.protocol === "https:" ? "wss:" : "ws:";
  return collabUrl.toString();
}

export function getSubdomainHost(): string {
  return getConfigValue("SUBDOMAIN_HOST");
}

export function isCloud(): boolean {
  return castToBoolean(getConfigValue("CLOUD"));
}

export function getAvatarUrl(
  avatarUrl: string,
  type: AvatarIconType = AvatarIconType.AVATAR,
) {
  if (!avatarUrl) return null;
  if (avatarUrl?.startsWith("http")) return avatarUrl;

  return getBackendUrl() + `/attachments/img/${type}/` + encodeURI(avatarUrl);
}

export function getSpaceUrl(spaceSlug: string) {
  return "/s/" + spaceSlug;
}

export function getFileUrl(src: string) {
  if (!src) return src;
  if (src.startsWith("http")) return src;
  if (src.startsWith("/api/")) {
    // Remove the '/api' prefix
    return getBackendUrl() + src.substring(4);
  }
  if (src.startsWith("/files/")) {
    return getBackendUrl() + src;
  }
  return sanitizeUrl(src);
}

export function getFileUploadSizeLimit() {
  const limit = getConfigValue("FILE_UPLOAD_SIZE_LIMIT", "50mb");
  return bytes(limit);
}

export function getFileImportSizeLimit() {
  const limit = getConfigValue("FILE_IMPORT_SIZE_LIMIT", "200mb");
  return bytes(limit);
}

export function getBillingTrialDays() {
  return getConfigValue("BILLING_TRIAL_DAYS");
}

export function getPostHogHost() {
  return getConfigValue("POSTHOG_HOST");
}

export function isPostHogEnabled(): boolean {
  return Boolean(getPostHogHost() && getPostHogKey());
}

export function getPostHogKey() {
  return getConfigValue("POSTHOG_KEY");
}

export function getDefaultLang(): string {
  // 운영: 서버가 index.html 에 window.CONFIG 를 주입한다.
  const injected = window?.CONFIG?.DEFAULT_LANG;
  if (injected) return injected;

  // dev: window.CONFIG 경로가 없어 vite define 으로 받는다. getConfigValue 의
  // dev 분기는 `process?.env` 로 읽는데 vite 의 define 은 옵셔널 체이닝 형태를
  // 치환하지 않아 항상 undefined 다 — 치환되는 비-옵셔널 형태로 직접 읽되,
  // 치환이 없는 환경에서는 process 가 아예 없으므로 ReferenceError 를 삼킨다.
  if (import.meta.env.DEV) {
    try {
      const fromBuild = process.env.DEFAULT_LANG;
      if (fromBuild) return fromBuild;
    } catch {
      // define 치환 없음 — 기본값으로
    }
  }

  return "en-US";
}

function getConfigValue(key: string, defaultValue: string = undefined): string {
  const rawValue = import.meta.env.DEV
    ? process?.env?.[key]
    : window?.CONFIG?.[key];
  return rawValue ?? defaultValue;
}
