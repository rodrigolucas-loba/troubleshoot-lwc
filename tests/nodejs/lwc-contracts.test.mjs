import assert from "node:assert/strict";
import test from "node:test";

import { compareComponent, flatten } from "../../scripts/nodejs/compare-lwc-contracts.mjs";
import { componentTag } from "../../scripts/nodejs/generate-lwc-contract-harness.mjs";

function node({ width = 100, color = "rgb(0, 0, 0)", children = [] } = {}) {
  return {
    path: "div:0",
    tag: "div",
    text: "content",
    rect: { width, height: 20 },
    styles: { color },
    children,
  };
}

test("componentTag maps LWC bundle casing without removing underscores", () => {
  assert.equal(componentTag("example1_Loop"), "c-example1_-loop");
});

test("flatten indexes the complete component tree", () => {
  const tree = node({ children: [{ ...node(), path: "span:0", tag: "span", children: [] }] });

  assert.equal(flatten(tree).size, 2);
});

test("contract comparison accepts dimensions inside tolerance", () => {
  assert.deepEqual(compareComponent("example", node(), node({ width: 101 }), 1), []);
});

test("contract comparison reports visual and style changes", () => {
  const differences = compareComponent("example", node(), node({ width: 103, color: "rgb(255, 0, 0)" }), 1);

  assert.deepEqual(
    differences.map(({ field }) => field),
    ["width", "color"],
  );
});
