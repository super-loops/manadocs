#!/usr/bin/env node
/**
 * 로케일 파일 정합성 검사.
 *
 * 이 앱은 t() 키로 영어 문장과 한글 문장을 **둘 다** 쓴다. i18next 설정이
 * `fallbackLng: "en-US"` 라 키 해석 순서가 이렇게 된다:
 *
 *   ko-KR 에 키 있음            → ko 값
 *   ko-KR 에 없고 en-US 에 있음 → **en 값** (한국어 화면에 영어가 뜬다)
 *   양쪽 다 없음                → 키 문자열 그대로
 *
 * 한글 리터럴 키는 "엔트리가 없어도 키 자체가 한국어라 잘 나온다"고 착각하기
 * 쉽다. 하지만 en-US 에 번역을 넣는 순간 fallback 이 이겨서 한국어 화면이
 * 통째로 영어가 된다(2026-08-25 회귀). 그래서 규칙은 둘이다:
 *
 *   1. ko-KR 은 **쓰이는 모든 키**를 가져야 한다 (한글 키는 값 == 키).
 *   2. en-US 는 **한글 리터럴 키**를 가져야 한다 (없으면 다른 언어에 한국어가 샌다).
 *      영어 키는 엔트리가 없어도 키 자체가 영어 표시라 무해하다.
 *
 * 사용: pnpm --filter ./apps/client run i18n:check
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(clientRoot, "src");
const LOCALES = join(clientRoot, "public", "locales");

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const hasHangul = (s) => /[가-힣]/.test(s);
const rel = (p) => relative(clientRoot, p);

function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** 소스에서 실제로 쓰이는 t() 키를 모은다 (키 -> 첫 등장 파일) */
function collectKeys() {
  const keys = new Map();
  const add = (key, where) => {
    if (key && !keys.has(key)) keys.set(key, rel(where));
  };

  const literal = /\bt\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;
  for (const file of walkFiles(SRC)) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(literal)) {
      const raw = m[1];
      try {
        add(raw[0] === '"' ? JSON.parse(raw) : raw.slice(1, -1), file);
      } catch {
        /* 이스케이프가 특이한 리터럴은 건너뛴다 */
      }
    }
  }

  // 동적 t() 호출 — 정적 스캔에 안 잡히므로 여기에 명시한다.
  const menu = join(SRC, "features/editor/components/slash-menu/menu-items.ts");
  for (const m of readFileSync(menu, "utf8").matchAll(
    /^\s+(?:title|description):\s*"([^"]*)"/gm,
  )) {
    add(m[1], menu); // command-list.tsx 의 t(item.title) / t(item.description)
  }
  const reviewTypes = join(SRC, "features/review/types/review.types.ts");
  const labelBlock = readFileSync(reviewTypes, "utf8").match(
    /REVIEW_STATUS_LABEL[^{]*\{([\s\S]*?)\}/,
  );
  if (labelBlock) {
    for (const m of labelBlock[1].matchAll(/:\s*"([^"]+)"/g)) {
      add(m[1], reviewTypes); // t(REVIEW_STATUS_LABEL[status])
    }
  }
  return keys;
}

const keys = collectKeys();
const ko = readJson(join(LOCALES, "ko-KR", "translation.json"));
const en = readJson(join(LOCALES, "en-US", "translation.json"));
const slots = (s) =>
  [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(",");

const problems = [];

for (const [key, where] of keys) {
  if (!(key in ko)) {
    problems.push(
      `ko-KR 누락: ${JSON.stringify(key)}  (${where})\n` +
        `      → 한글 키면 값도 키와 같게, 영어 키면 한국어 번역을 넣어라.\n` +
        `        없으면 en-US 값이 이겨서 한국어 화면에 영어가 뜬다.`,
    );
  }
  if (hasHangul(key) && !(key in en)) {
    problems.push(
      `en-US 누락: ${JSON.stringify(key)}  (${where})\n` +
        `      → 한글 키는 en-US 번역이 있어야 다른 언어에 한국어가 새지 않는다.`,
    );
  }
  for (const [name, table] of [
    ["ko-KR", ko],
    ["en-US", en],
  ]) {
    if (key in table && slots(table[key]) !== slots(key)) {
      problems.push(
        `${name} 자리표시자 불일치: ${JSON.stringify(key)} -> ${JSON.stringify(table[key])}`,
      );
    }
  }
}

if (problems.length) {
  console.error(`i18n 검사 실패 — ${problems.length}건\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}

const koreanKeys = [...keys.keys()].filter(hasHangul).length;
console.log(
  `i18n 검사 통과 — 사용 키 ${keys.size}개 (한글 리터럴 ${koreanKeys}개), ` +
    `ko-KR ${Object.keys(ko).length} · en-US ${Object.keys(en).length} 엔트리`,
);
