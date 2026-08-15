import prismaPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = prismaPkg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Missing DATABASE_URL environment variable");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Ensure organization exists
  const org = await prisma.organization.upsert({
    where: { name: "Biltoki" },
    update: {},
    create: { name: "Biltoki" },
  });

  console.log(`Organization: ${org.name} (${org.id})`);

  // Define all 10 Biltoki halls with proper French accents
  const hallsData = [
    { name: "Halles de Biltoki Bordeaux", city: "Bordeaux" },
    { name: "Halles de Biltoki Rueil-Malmaison", city: "Rueil-Malmaison" },
    { name: "Halles de Biltoki Angers", city: "Angers" },
    { name: "Halles de Biltoki Béziers", city: "Béziers" },
    { name: "Halles de Biltoki Toulon", city: "Toulon" },
    { name: "Halles de Biltoki Annecy", city: "Annecy" },
    { name: "Halles de Biltoki Villeneuve-d'Ascq", city: "Villeneuve-d'Ascq" },
    { name: "Halles de Biltoki Amiens", city: "Amiens" },
    { name: "Halles de Biltoki Anglet", city: "Anglet" },
    { name: "Halles de Biltoki Issy-les-Moulineaux", city: "Issy-les-Moulineaux" },
  ];

  // Upsert all halls (creates if not exists, updates if exists)
  const syncedHalls: Array<{ id: string; name: string }> = [];
  for (const hallData of hallsData) {
    const hall = await prisma.hall.upsert({
      where: {
        organizationId_name: {
          organizationId: org.id,
          name: hallData.name,
        },
      },
      update: { city: hallData.city, active: true },
      create: {
        organizationId: org.id,
        ...hallData,
        active: true,
      },
    });

    console.log(`✓ Hall "${hall.name}" (${hall.id})`);
    syncedHalls.push({ id: hall.id, name: hall.name });
  }

  console.log(
    "\n✅ Database seeded successfully! All 10 Biltoki halls are ready."
  );

  // Print HALLS_TO_SYNC configuration hint for the 10 target halls only.
  const halls = [...syncedHalls].sort((a, b) => a.name.localeCompare(b.name));

  console.log("\n📋 Use this for HALLS_TO_SYNC environment variable:");
  console.log(`\nHALLS_TO_SYNC=${halls.map((h) => h.id).join(",")}`);

  console.log("\n📋 Hall UUIDs for reference:");
  halls.forEach((h) => {
    console.log(`  ${h.name}: ${h.id}`);
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
