import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newPairing } from "../../src/lib/ilias/pairing";
import {
  claimSession,
  readSession,
  saveSession,
  deleteSession,
  withSessionLock,
  type Session,
} from "../../src/lib/ilias/session";
async function connected() {
  const pairing = newPairing();
  const session: Session = {
    id: randomUUID(),
    instance: "https://ilias.uni-freiburg.de/",
    createdAt: Date.now(),
    status: "connected",
    pairing: { digest: pairing.digest, expiresAt: pairing.expiresAt },
  };
  await saveSession(session);
  return { session, token: `${session.id}.${pairing.secret}` };
}
const first = await connected();
const claims = await Promise.allSettled([
  claimSession(first.token),
  claimSession(first.token),
]);
assert.equal(claims.filter((claim) => claim.status === "fulfilled").length, 1);
assert.equal((await readSession(first.session.id))?.pairing, undefined);
await assert.rejects(claimSession(first.token));
await assert.rejects(claimSession(first.token + ".extra"));

// Holding one account's lock must not block a different account's claim.
const blocked = await connected();
const independent = await connected();
let release!: () => void;
const held = new Promise<void>((resolve) => {
  release = resolve;
});
const lock = withSessionLock(blocked.session.id, () => held);
assert.equal(await claimSession(independent.token), independent.session.id);
const deleted = deleteSession(blocked.session.id);
const cancelledClaim = claimSession(blocked.token);
release();
await lock;
await deleted;
await assert.rejects(cancelledClaim);
assert.equal(await readSession(blocked.session.id), null);
console.log("verified");
