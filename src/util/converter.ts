import {hiraganaMap, maxKeyLength} from "./conversionTable.js";


/**
 * ローマ字をひらがなに変換する
 * @param romaji ローマ字
 * @returns ひらがな
 */
export function romajiToHiragana(romaji: string): string {
  let hiragana = "";
  let i = 0;

  while (i < romaji.length) {
    let found = false;

    for (let j = maxKeyLength; j >= 1; j--) {
      if (i + j > romaji.length) continue;
      const substring = romaji.substring(i, i + j);

      const entry = hiraganaMap.get(substring);
      if (entry === undefined) continue;

      hiragana += entry[0];
      i += j + entry[1];
      found = true;
      break;
    }

    if (!found) {
      hiragana += romaji.charAt(i);
      i++;
    }
  }

  return hiragana;
}

/**
 * ひらがなを必要に応じて分割しながら日本語に変換する
 * @param hiragana ひらがな
 * @returns 日本語
 */
export async function hiraganaToJapanese(hiragana: string): Promise<string> {
  // 空白で分割して並列で変換し、変換結果に空の要素があればエラーをスロー
  const parts = hiragana.split(" ");
  const result = await Promise.all(
    parts.map((part) => hiraganaPartsToJapanese(part))
  );

  if (result.some((r) => r === "")) {
    throw new ConversionError("Message too long");
  }

  return result.join(" ");
}

/**
 * ひらがなを日本語に変換する
 * @param hiragana ひらがな
 * @returns 日本語
 */
async function hiraganaPartsToJapanese(hiragana: string): Promise<string> {
  try {
    // GoogleのAPIを使って変換
    const url =
      "https://www.google.com/transliterate?langpair=ja-Hira|ja&text=" +
      encodeURIComponent(hiragana);

    const response = await fetch(url);
    const content = await response.text();

    // JSONとして解析
    const jsonArray: [string, string[]][] = JSON.parse(content);

    // 配列をループし、最初の変換結果を選択
    let result = "";
    for (const element of jsonArray) {
      const firstConversionResult = element[1][0];
      result += firstConversionResult;
    }

    // 全角ASCII文字を半角に変換して返す
    return result.replace(/[！-～]/g, (m) =>
      String.fromCharCode(m.charCodeAt(0) - 0xFEE0)
    );
  } catch (e) {
    throw new ConversionError(
      `Error during conversion "${hiragana}" to Japanese: ${e instanceof Error ? e.message : e}`
    );
  }
}

/**
 * ローマ字を日本語に変換する
 * @param romaji ローマ字
 * @returns 日本語
 */
export async function romajiToJapanese(romaji: string): Promise<string> {
  return hiraganaToJapanese(romajiToHiragana(romaji));
}

export function isAsciiOnly(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) >= 128) return false;
  }
  return true;
}

export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversionError";
  }
}