import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.DB_PATH = path.join(process.cwd(), "server", "data", "avoid-poop-e2e.sqlite");

const {createApp} = await import("../../server/src/app.ts");
const {resetDbForTests} = await import("../../server/src/db/client.ts");

async function main() {
  const app = await createApp();

  try {
    const username = `player_${Date.now()}`;
    const signup = await app.inject({
      method: "POST",
      url: "/api/auth/signup",
      payload: {
        username,
        password: "secret123"
      }
    });
    assert.equal(signup.statusCode, 200);

    const cookie = signup.cookies[0];
    assert.ok(cookie?.value, "expected session cookie");

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: {
        avoid_poop_session: cookie.value
      }
    });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.username, username);
    assert.equal(me.json().authenticated, true);

    const normalSave = await app.inject({
      method: "POST",
      url: "/api/records",
      cookies: {
        avoid_poop_session: cookie.value
      },
      payload: {
        mode: "normal",
        score: 111,
        reachedRound: 3,
        survivalTime: 17.4,
        clear: false
      }
    });
    assert.equal(normalSave.statusCode, 201);

    const hardSave = await app.inject({
      method: "POST",
      url: "/api/records",
      cookies: {
        avoid_poop_session: cookie.value
      },
      payload: {
        mode: "hard",
        score: 222,
        reachedRound: 5,
        survivalTime: 24.8,
        clear: false
      }
    });
    assert.equal(hardSave.statusCode, 201);

    const records = await app.inject({
      method: "GET",
      url: "/api/records",
      cookies: {
        avoid_poop_session: cookie.value
      }
    });
    assert.equal(records.statusCode, 200);
    const recordsBody = records.json();
    assert.equal(recordsBody.best.normal.score, 111);
    assert.equal(recordsBody.best.hard.score, 222);
    assert.equal(recordsBody.recent.length, 2);

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: {
        avoid_poop_session: cookie.value
      }
    });
    assert.equal(logout.statusCode, 200);

    const meAfterLogout = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: {
        avoid_poop_session: cookie.value
      }
    });
    assert.equal(meAfterLogout.statusCode, 401);

    console.log("e2e flow passed");
  } finally {
    await app.close();
    resetDbForTests();
    if (fs.existsSync(process.env.DB_PATH)) {
      fs.unlinkSync(process.env.DB_PATH);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
