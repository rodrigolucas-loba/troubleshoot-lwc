import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanupJavaScript,
  cleanupText,
  findEnclosingBrace,
  findMatchingBrace,
} from "../../scripts/nodejs/basic-code-cleanup-guard.mjs";

test("cleanupText preserves CRLF while removing trailing whitespace", () => {
  const result = cleanupText("first  \r\nsecond\t");

  assert.equal(result.content, "first\r\nsecond\r\n");
  assert.equal(result.trailingWhitespaceLines, 2);
  assert.equal(result.addedFinalNewline, true);
});

test("cleanupJavaScript applies conservative analyzer fixes", () => {
  const input = `class Example {
  handler(event) {
    var endpoint = "http://example.test";
    let copy = JSON.parse(JSON.stringify(this.value));
    let random = Math.random();
    return { endpoint, copy, random };
  }
}`;

  const result = cleanupJavaScript(input);

  assert.match(result.content, /handler\(\)/);
  assert.match(result.content, /https:\/\/example\.test/);
  assert.match(result.content, /structuredClone\(this\.value\)/);
  assert.match(result.content, /crypto\.getRandomValues/);
  assert.equal(result.varToLet, 1);
  assert.equal(result.unusedEventParamsRemoved, 1);
  assert.ok(result.letToConst >= 1);
});

test("brace scanning ignores braces inside strings and comments", () => {
  const content = `function run() { const text = "}"; /* { */ return { ok: true }; }`;
  const open = content.indexOf("{");
  const close = findMatchingBrace(content, open);

  assert.equal(close, content.length - 1);
  assert.equal(findEnclosingBrace(content, content.indexOf("return")), open);
});
