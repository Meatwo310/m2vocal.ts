import {isAsciiOnly} from "../util/converter.js";

const ignorePattern = /https?:\/\/|<(@|a?:)/;

export function shouldConvert(text: string): boolean {
  return isAsciiOnly(text) && !ignorePattern.test(text);
}
