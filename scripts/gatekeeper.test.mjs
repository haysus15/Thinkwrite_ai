import assert from "node:assert/strict";
import { evaluateGatekeeperWarnings } from "../src/services/voice-profile/gatekeeper.js";

const base = {
  primaryChamber: "career",
  primaryCount: 1,
  generalCount: 0,
  requestedChambers: ["career", "general", "overall"],
};

const thin = evaluateGatekeeperWarnings(base);
assert.equal(thin.combinedDocumentCount, 1);
assert.ok(thin.warnings.some((w) => w.includes("Voice data is thin")));

const ok = evaluateGatekeeperWarnings({
  primaryChamber: "career",
  primaryCount: 2,
  generalCount: 2,
  requestedChambers: ["career", "general", "overall"],
});
assert.ok(!ok.warnings.some((w) => w.includes("Voice data is thin")));

const nonPrimary = evaluateGatekeeperWarnings({
  primaryChamber: "career",
  primaryCount: 3,
  generalCount: 0,
  requestedChambers: ["career", "creative"],
});
assert.ok(nonPrimary.warnings.some((w) => w.includes("non-primary")));

const onlyPrimary = evaluateGatekeeperWarnings({
  primaryChamber: "academic",
  primaryCount: 3,
  generalCount: 0,
  requestedChambers: ["academic", "overall"],
});
assert.ok(!onlyPrimary.warnings.some((w) => w.includes("non-primary")));

console.log("gatekeeper warnings tests passed");
