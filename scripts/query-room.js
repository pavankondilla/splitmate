import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./src/db/schema/index.js";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

async function queryRoom() {
  try {
    // Get the Flat_Mates room
    const rooms = await db.query.rooms.findMany({
      where: eq(schema.rooms.name, "Flat_Mates"),
    });

    if (!rooms.length) {
      console.log("No room found named 'Flat_Mates'");
      return;
    }

    const room = rooms[0];
    console.log("\n=== ROOM DETAILS ===");
    console.log(`Name: ${room.name}`);
    console.log(`ID: ${room.id}`);
    console.log(`Currency: ${room.currency}`);
    console.log(`Created: ${room.createdAt}`);

    // Get members
    const members = await db.query.roomMembers.findMany({
      where: eq(schema.roomMembers.roomId, room.id),
      with: {
        user: true,
      },
    });

    console.log("\n=== MEMBERS ===");
    members.forEach((m) => {
      console.log(`- ${m.user.name} (${m.user.email}) - Role: ${m.role}`);
    });

    // Get expenses
    const expenses = await db.query.expenses.findMany({
      where: eq(schema.expenses.roomId, room.id),
      with: {
        paidByUser: true,
        participants: {
          with: { user: true },
        },
      },
    });

    console.log("\n=== EXPENSES ===");
    expenses.forEach((exp) => {
      console.log(`\n${exp.title}`);
      console.log(`  Amount: ₹${(exp.amount / 100000).toFixed(2)}`);
      console.log(`  Paid by: ${exp.paidByUser.name}`);
      console.log(`  Date: ${exp.expenseDate}`);
      console.log(`  Category: ${exp.category}`);
      console.log(`  Split:`);
      exp.participants.forEach((p) => {
        console.log(`    - ${p.user.name}: ₹${(p.shareAmount / 100000).toFixed(2)}`);
      });
    });

    // Get settlements
    const settlements = await db.query.settlements.findMany({
      where: eq(schema.settlements.roomId, room.id),
      with: {
        payer: true,
        payee: true,
      },
    });

    console.log("\n=== SETTLEMENTS ===");
    settlements.forEach((s) => {
      console.log(
        `${s.payer.name} paid ${s.payee.name}: ₹${(s.amount / 100000).toFixed(2)} on ${s.settledAt}`
      );
      if (s.note) console.log(`  Note: ${s.note}`);
    });

    // Calculate balances manually
    console.log("\n=== BALANCES ===");
    const memberMap = new Map(members.map((m) => [m.userId, m.user.name]));

    for (const member of members) {
      let totalOwedToMember = 0;
      let totalMemberOwes = 0;

      // Sum expenses paid by member but split with others
      for (const exp of expenses) {
        if (exp.paidBy === member.userId) {
          for (const part of exp.participants) {
            if (part.userId !== member.userId) {
              totalOwedToMember += part.shareAmount;
            }
          }
        }
      }

      // Sum member's share of expenses paid by others
      for (const exp of expenses) {
        if (exp.paidBy !== member.userId) {
          for (const part of exp.participants) {
            if (part.userId === member.userId) {
              totalMemberOwes += part.shareAmount;
            }
          }
        }
      }

      // Subtract settlements
      let settlementsPaid = 0;
      let settlementsReceived = 0;

      for (const s of settlements) {
        if (s.payerId === member.userId) settlementsPaid += s.amount;
        if (s.payeeId === member.userId) settlementsReceived += s.amount;
      }

      const netBalance =
        totalOwedToMember - settlementsPaid - (totalMemberOwes - settlementsReceived);

      console.log(`\n${member.user.name}:`);
      console.log(`  Others owe you: ₹${(totalOwedToMember / 100000).toFixed(2)}`);
      console.log(`  You owe others: ₹${(totalMemberOwes / 100000).toFixed(2)}`);
      console.log(`  Settlements paid: ₹${(settlementsPaid / 100000).toFixed(2)}`);
      console.log(
        `  Settlements received: ₹${(settlementsReceived / 100000).toFixed(2)}`
      );
      console.log(
        `  Net balance: ₹${(netBalance / 100000).toFixed(2)} ${netBalance > 0 ? "(owed to you)" : "(you owe)"}`
      );
    }
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

queryRoom();
