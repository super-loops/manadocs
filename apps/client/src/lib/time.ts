import { formatDistanceStrict } from "date-fns";
import { format, isToday, isYesterday } from "date-fns";
import {
  de,
  enUS,
  es,
  fr,
  it,
  ja,
  ko,
  nl,
  ptBR,
  ru,
  uk,
  zhCN,
} from "date-fns/locale";
import type { Locale } from "date-fns";
import i18n from "@/i18n.ts";

/**
 * public/locales 의 언어 코드 → date-fns 로케일.
 * 이걸 주입하지 않으면 date-fns 가 언어와 무관하게 항상 영어로 찍는다
 * ("3 minutes ago"). 버전·작업문서 카드, 리뷰 코멘트 타임스탬프 공통.
 */
const DATE_FNS_LOCALES: Record<string, Locale> = {
  "de-DE": de,
  "en-US": enUS,
  "es-ES": es,
  "fr-FR": fr,
  "it-IT": it,
  "ja-JP": ja,
  "ko-KR": ko,
  "nl-NL": nl,
  "pt-BR": ptBR,
  "ru-RU": ru,
  "uk-UA": uk,
  "zh-CN": zhCN,
};

function dateLocale(): Locale {
  return DATE_FNS_LOCALES[i18n.language] ?? enUS;
}

export function timeAgo(date: Date) {
  return formatDistanceStrict(new Date(date), new Date(), {
    addSuffix: true,
    locale: dateLocale(),
  });
}

export function formattedDate(date: Date) {
  const locale = dateLocale();
  // p / PP 는 로케일이 정의한 시간·날짜 포맷 (ko: "오후 9:45" / "2026년 8월 25일")
  if (isToday(date)) {
    return i18n.t("Today, {{time}}", { time: format(date, "p", { locale }) });
  } else if (isYesterday(date)) {
    return i18n.t("Yesterday, {{time}}", {
      time: format(date, "p", { locale }),
    });
  } else {
    return format(date, "PP, p", { locale });
  }
}
