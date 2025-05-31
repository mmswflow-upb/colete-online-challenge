// test-client.js
//
// Runs a full duel, printing detailed stats each round (as sent by the server),
// until one player dies. Listens to the server's “roundResult” event, which
// includes attacker, defender, ability used (if any), damage, and post‐round health.
//
// Steps:
//   1) POST /games           → get { sessionId, joinLink }
//   2) GET /games/:sessionId/slots → choose first available slot
//   3) POST /games/:sessionId/join → Player 1 joins (warrior + offense)
//   4) GET /games/:sessionId/slots → choose next slot
//   5) POST /games/:sessionId/join → Player 2 joins (mage + offense)
//   6) Open two Socket.IO connections, each emits "join"
//   7) Listen for "roundResult" from server and print those details
//   8) Alternate emitting "useAbility" until roundResult indicates someone is dead
//   9) Disconnect sockets and exit.
//
// Requires Node 18+ (for built-in fetch) and socket.io-client:
//
//    npm install socket.io-client
//
// ─────────────────────────────────────────────────────────────────────────────
// 1) Configuration (match src/config exactly)
// ─────────────────────────────────────────────────────────────────────────────

// Your server’s base URL:
const SERVER_URL = "http://localhost:3000";

// Player 1: “warrior” with offense ability “boostAttackOnAttack”
const PLAYER1_CHAR = "warrior";
const PLAYER1_ABILITY_KIND = "defense";
const PLAYER1_ABILITY_ID = "halfDamageOnDefend";

// Player 2: “mage” with offense ability “boostAttackOnAttack”
const PLAYER2_CHAR = "mage";
const PLAYER2_ABILITY_KIND = "offense";
const PLAYER2_ABILITY_ID = "boostAttackOnAttack";

// ─────────────────────────────────────────────────────────────────────────────
// 2) Import Socket.IO client
// ─────────────────────────────────────────────────────────────────────────────
const { io } = require("socket.io-client");

// ─────────────────────────────────────────────────────────────────────────────
// 3) Main async IIFE
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: Create a new game → POST /games
    // ─────────────────────────────────────────────────────────────────────────
    console.log("→ Creating a new game...");
    const createRes = await fetch(`${SERVER_URL}/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!createRes.ok) {
      throw new Error(`POST /games failed: HTTP ${createRes.status}`);
    }
    const { sessionId, joinLink } = await createRes.json();
    console.log("✔ Created session:", sessionId);
    console.log("  (Join Link:", joinLink, ")");

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Player 1 fetches available slots → GET /games/:sessionId/slots
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n→ Player 1: fetching available slots...");
    const slotsRes1 = await fetch(`${SERVER_URL}/games/${sessionId}/slots`);
    if (!slotsRes1.ok) {
      throw new Error(
        `GET /games/${sessionId}/slots failed: HTTP ${slotsRes1.status}`
      );
    }
    const { availableSlots: slots1 } = await slotsRes1.json();
    if (slots1.length === 0) {
      throw new Error("No slots available for Player 1!");
    }
    const chosenSlot1 = slots1[0];
    console.log(
      "  Available slots:",
      slots1,
      "→ Player 1 chooses slot",
      chosenSlot1
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Player 1 joins → POST /games/:sessionId/join
    // ─────────────────────────────────────────────────────────────────────────
    const joinRes1 = await fetch(`${SERVER_URL}/games/${sessionId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterTypeId: PLAYER1_CHAR,
        abilityKind: PLAYER1_ABILITY_KIND,
        abilityId: PLAYER1_ABILITY_ID,
        preferredSlot: chosenSlot1,
      }),
    });
    if (!joinRes1.ok) {
      const errJson = await joinRes1.json().catch(() => ({}));
      throw new Error(
        `Player 1 join failed: ${errJson.error || joinRes1.status}`
      );
    }
    const { playerId: player1Id } = await joinRes1.json();
    console.log("✔ Player 1 joined with playerId:", player1Id);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Player 2 fetches available slots → GET /games/:sessionId/slots
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n→ Player 2: fetching available slots...");
    const slotsRes2 = await fetch(`${SERVER_URL}/games/${sessionId}/slots`);
    if (!slotsRes2.ok) {
      throw new Error(
        `GET /games/${sessionId}/slots failed: HTTP ${slotsRes2.status}`
      );
    }
    const { availableSlots: slots2 } = await slotsRes2.json();
    if (slots2.length === 0) {
      throw new Error("No slots available for Player 2!");
    }
    const chosenSlot2 = slots2[0];
    console.log(
      "  Available slots:",
      slots2,
      "→ Player 2 chooses slot",
      chosenSlot2
    );

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Player 2 joins → POST /games/:sessionId/join
    // ─────────────────────────────────────────────────────────────────────────
    const joinRes2 = await fetch(`${SERVER_URL}/games/${sessionId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterTypeId: PLAYER2_CHAR,
        abilityKind: PLAYER2_ABILITY_KIND,
        abilityId: PLAYER2_ABILITY_ID,
        preferredSlot: chosenSlot2,
      }),
    });
    if (!joinRes2.ok) {
      const errJson = await joinRes2.json().catch(() => ({}));
      throw new Error(
        `Player 2 join failed: ${errJson.error || joinRes2.status}`
      );
    }
    const { playerId: player2Id } = await joinRes2.json();
    console.log("✔ Player 2 joined with playerId:", player2Id);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 6: Open two Socket.IO connections & emit "join"
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n→ Opening Socket.IO connections for both players...");
    const socket1 = io(SERVER_URL);
    const socket2 = io(SERVER_URL);

    // ─────────────────────────────────────────────────────────────────────────
    // State tracking (to know when to emit next attack)
    // ─────────────────────────────────────────────────────────────────────────
    let bothConnected = false;
    let nextAttacker = player1Id; // start with Player 1
    let gameOver = false;

    // ─────────────────────────────────────────────────────────────────────────
    // Listen for detailed "roundResult" events from server
    // ─────────────────────────────────────────────────────────────────────────
    socket1.on("roundResult", (rr) => {
      // rr = {
      //   roundNumber: number,
      //   sessionId: string,
      //   attackerId: string,
      //   attackerName: string,
      //   defenderId: string,
      //   defenderName: string,
      //   abilityUsed: string | null,
      //   damageDealt: number,
      //   healthAfter: { [playerId]: number }
      // }
      console.group(`--- Round ${rr.roundNumber} ---`);
      console.log(
        `${rr.attackerName} [${rr.attackerId}] → ${rr.defenderName} [${rr.defenderId}]`
      );
      if (rr.abilityUsed) {
        console.log(`▶ Ability Triggered: ${rr.abilityUsed}`);
      } else {
        console.log("▶ No ability triggered this round");
      }
      console.log(`▶ Damage Dealt: ${rr.damageDealt}`);
      console.log("▶ Health After Round:");
      for (const [pid, hp] of Object.entries(rr.healthAfter)) {
        console.log(`   • ${pid} → ${hp} HP`);
      }
      console.groupEnd();

      // If either health is zero, game over
      const p1Hp = rr.healthAfter[player1Id];
      const p2Hp = rr.healthAfter[player2Id];
      if (p1Hp <= 0 || p2Hp <= 0) {
        gameOver = true;
        const winner =
          p1Hp <= 0
            ? `Player 2 (Mage) [${player2Id}]`
            : `Player 1 (Warrior) [${player1Id}]`;
        console.log(`\n*** Game Over! ${winner} wins! ***\n`);
        socket1.disconnect();
        socket2.disconnect();
        process.exit(0);
      } else {
        // Otherwise, schedule next attack from the other player
        if (!gameOver && bothConnected) {
          if (nextAttacker === player1Id) {
            console.log(`\n[Test] Player 1 (Warrior) attacks Player 2 (Mage)`);
            socket1.emit("useAbility", {
              sessionId,
              fromPlayer: player1Id,
              toPlayer: player2Id,
            });
            nextAttacker = player2Id;
          } else {
            console.log(`\n[Test] Player 2 (Mage) attacks Player 1 (Warrior)`);
            socket2.emit("useAbility", {
              sessionId,
              fromPlayer: player2Id,
              toPlayer: player1Id,
            });
            nextAttacker = player1Id;
          }
        }
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Listen for raw "state" updates so we know when bothConnected becomes true
    // ─────────────────────────────────────────────────────────────────────────
    socket1.on("state", (state) => {
      if (state.bothConnected && !bothConnected) {
        bothConnected = true;
        console.log("\n>>> Both players connected. Starting duel! <<<");
        // Trigger the first attack immediately
        console.log(`\n--- Round 1 ---`);
        console.log(`Player 1 (Warrior) attacks Player 2 (Mage)`);
        socket1.emit("useAbility", {
          sessionId,
          fromPlayer: player1Id,
          toPlayer: player2Id,
        });
        nextAttacker = player2Id;
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // When sockets connect, emit "join" for each player
    // ─────────────────────────────────────────────────────────────────────────
    socket1.on("connect", () => {
      socket1.emit("join", { sessionId, playerId: player1Id });
    });
    socket2.on("connect", () => {
      socket2.emit("join", { sessionId, playerId: player2Id });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // Handle any server-sent “error” messages for debugging
    // ─────────────────────────────────────────────────────────────────────────
    socket1.on("error", (err) => console.log("[Socket1][error]:", err));
    socket2.on("error", (err) => console.log("[Socket2][error]:", err));
  } catch (err) {
    console.error("▶ Test-script error:", err);
    process.exit(1);
  }
})();
