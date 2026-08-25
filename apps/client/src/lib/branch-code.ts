import type { TFunction } from "i18next";

/**
 * 분기코드 — 작업문서(분기)를 사람·에이전트가 눈으로 맞추기 위한 짧은 표시용 코드.
 * "지금 우리가 같은 분기를 보고 있나?" 를 URL·id 없이 확인하는 용도라
 * 저장하지 않고 id 에서 유도한다(마이그레이션 없음).
 *
 * ⚠ uuid v7 의 **앞자리는 생성 시각**이다. 같은 날 만든 분기끼리 앞 4~5자가
 * 통째로 겹치므로 앞자리는 쓸 수 없다. 랜덤 구간인 **끝 5자**를 쓴다.
 */
export const BRANCH_CODE_LENGTH = 5;

/** 작업문서 id → 분기코드 (대문자 hex 5자). id 가 없으면 빈 문자열. */
export function getBranchCode(
  workingDocId: string | null | undefined,
): string {
  if (!workingDocId) return "";
  const hex = workingDocId.replace(/-/g, "");
  return hex.slice(-BRANCH_CODE_LENGTH).toUpperCase();
}

/**
 * 버전·분기 한 줄 표기 — footer pill·결합 패널·트리 hover 툴팁이 같은 문구를 쓴다.
 *   확정본 있음: `버전 3 · A1B2C (버전 2에서 시작)`
 *   미확정:      `미확정 · A1B2C`
 * baseVersion 이 현재 버전과 같으면 "(…에서 시작)" 을 생략한다(같은 말 반복).
 */
export function formatVersionSummary(
  t: TFunction,
  opts: {
    /** 페이지의 Primary 확정 버전 번호. 확정본이 없으면 null */
    version: number | null | undefined;
    /** 작업문서 id 에서 유도한 분기코드 (빈 문자열이면 생략) */
    branchCode: string;
    /** 작업문서가 base 로 삼은 버전 번호 */
    baseVersion?: number | null;
  },
): string {
  const head =
    opts.version === null || opts.version === undefined
      ? t("미확정")
      : t("버전 {{n}}", { n: opts.version });
  const code = opts.branchCode ? ` · ${opts.branchCode}` : "";
  const from =
    opts.baseVersion !== null &&
    opts.baseVersion !== undefined &&
    opts.baseVersion !== opts.version
      ? ` (${t("버전 {{n}}에서 시작", { n: opts.baseVersion })})`
      : "";
  return `${head}${code}${from}`;
}
