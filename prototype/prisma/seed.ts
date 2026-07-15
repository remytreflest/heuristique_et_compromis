import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

// Secret TOTP partagé pour les comptes de démo, afin qu'un correcteur puisse se connecter sans
// passer par l'enrôlement (testable séparément via /inscription). Voir prototype/README.md.
const DEMO_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

async function demoPassword() {
  return hashPassword("Demo1234!");
}

async function main() {
  console.log("Seed: nettoyage...");
  await prisma.notificationLog.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
  await prisma.salon.deleteMany();

  const [salonLyon, salonParis, salonMarseille] = await Promise.all([
    prisma.salon.create({ data: { name: "Salon Étoile", city: "Lyon", address: "12 rue de la République" } }),
    prisma.salon.create({ data: { name: "Salon Lumière", city: "Paris", address: "5 rue de Rivoli" } }),
    prisma.salon.create({ data: { name: "Salon Waha", city: "Marseille", address: "8 la Canebière" } }),
  ]);

  const [coupe, coloration, brushing] = await Promise.all([
    prisma.service.create({ data: { key: "coupe" } }),
    prisma.service.create({ data: { key: "coloration" } }),
    prisma.service.create({ data: { key: "brushing" } }),
  ]);

  const { hash, salt } = await demoPassword();

  const julie = await prisma.user.create({
    data: {
      role: "COIFFEUR",
      email: "coiffeur1@example.com",
      name: "Julie Martin",
      languages: ["fr", "en"],
      services: ["coupe", "coloration", "brushing"],
      salonId: salonLyon.id,
      passwordHash: hash,
      passwordSalt: salt,
      totpSecret: DEMO_TOTP_SECRET,
      totpEnabled: true,
    },
  });

  const karim = await prisma.user.create({
    data: {
      role: "COIFFEUR",
      email: "coiffeur2@example.com",
      name: "Karim Haddad",
      languages: ["fr", "ar"],
      services: ["coupe", "coloration"],
      salonId: salonMarseille.id,
      passwordHash: hash,
      passwordSalt: salt,
      totpSecret: DEMO_TOTP_SECRET,
      totpEnabled: true,
    },
  });

  const emma = await prisma.user.create({
    data: {
      role: "COIFFEUR",
      email: "coiffeur3@example.com",
      name: "Emma Clarke",
      languages: ["en"],
      services: ["coupe", "brushing"],
      salonId: salonParis.id,
      passwordHash: hash,
      passwordSalt: salt,
      totpSecret: DEMO_TOTP_SECRET,
      totpEnabled: true,
    },
  });

  const client = await prisma.user.create({
    data: {
      role: "CLIENT",
      email: "client@example.com",
      name: "Sam Client",
      languages: ["fr"],
      passwordHash: hash,
      passwordSalt: salt,
      totpSecret: DEMO_TOTP_SECRET,
      totpEnabled: true,
    },
  });

  await prisma.user.create({
    data: {
      role: "GESTION",
      email: "gestion@example.com",
      name: "Direction Réseau",
      languages: ["fr"],
      passwordHash: hash,
      passwordSalt: salt,
      totpSecret: DEMO_TOTP_SECRET,
      totpEnabled: true,
    },
  });

  // Clients "de volume" pour peupler les statistiques agrégées (BF-13) sans compte de démo dédié.
  const fillerClients = await Promise.all(
    Array.from({ length: 8 }).map((_, i) =>
      prisma.user.create({
        data: {
          role: "CLIENT",
          email: `client.demo${i + 1}@example.com`,
          name: `Client Démo ${i + 1}`,
          languages: ["fr"],
          passwordHash: hash,
          passwordSalt: salt,
        },
      })
    )
  );

  function futureSlot(daysFromNow: number, hour: number) {
    const start = new Date();
    start.setDate(start.getDate() + daysFromNow);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 45);
    return { start, end };
  }

  function pastSlot(daysAgo: number, hour: number) {
    const start = new Date();
    start.setDate(start.getDate() - daysAgo);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 45);
    return { start, end };
  }

  // Créneaux disponibles à venir (BF-03 / BF-04), répartis sur les trois coiffeurs.
  const coiffeurs = [
    { user: julie, services: [coupe, coloration, brushing] },
    { user: karim, services: [coupe, coloration] },
    { user: emma, services: [coupe, brushing] },
  ];

  for (const { user, services } of coiffeurs) {
    let day = 1;
    for (const service of services) {
      for (const hour of [9, 11, 14, 16]) {
        const { start, end } = futureSlot(day, hour);
        await prisma.slot.create({
          data: { coiffeurId: user.id, serviceId: service.id, start, end, status: "AVAILABLE" },
        });
      }
      day += 1;
    }
  }

  // Un rendez-vous déjà confirmé et un en attente de validation, pour que /espace-client et
  // /pro/demandes affichent immédiatement quelque chose au premier lancement.
  const confirmedSlot = await prisma.slot.create({
    data: { ...futureSlot(2, 10), coiffeurId: julie.id, serviceId: coupe.id, status: "BOOKED" },
  });
  await prisma.appointment.create({
    data: {
      slotId: confirmedSlot.id,
      clientId: client.id,
      serviceId: coupe.id,
      status: "CONFIRMED",
      idempotencyKey: randomUUID(),
    },
  });

  const pendingSlot = await prisma.slot.create({
    data: { ...futureSlot(3, 15), coiffeurId: julie.id, serviceId: brushing.id, status: "BOOKED" },
  });
  await prisma.appointment.create({
    data: {
      slotId: pendingSlot.id,
      clientId: client.id,
      serviceId: brushing.id,
      status: "PENDING",
      idempotencyKey: randomUUID(),
    },
  });

  // Volume d'historique : 6 coupes confirmées chez Julie (Lyon) — franchit le seuil de k-anonymat (5) —
  // et 2 colorations chez Karim (Marseille) — reste en dessous, pour démontrer la suppression BF-13.
  for (let i = 0; i < 6; i += 1) {
    const slot = await prisma.slot.create({
      data: { ...pastSlot(10 + i, 10), coiffeurId: julie.id, serviceId: coupe.id, status: "BOOKED" },
    });
    await prisma.appointment.create({
      data: {
        slotId: slot.id,
        clientId: fillerClients[i % fillerClients.length].id,
        serviceId: coupe.id,
        status: "CONFIRMED",
        idempotencyKey: randomUUID(),
      },
    });
  }

  for (let i = 0; i < 2; i += 1) {
    const slot = await prisma.slot.create({
      data: { ...pastSlot(5 + i, 11), coiffeurId: karim.id, serviceId: coloration.id, status: "BOOKED" },
    });
    await prisma.appointment.create({
      data: {
        slotId: slot.id,
        clientId: fillerClients[i].id,
        serviceId: coloration.id,
        status: "CONFIRMED",
        idempotencyKey: randomUUID(),
      },
    });
  }

  console.log("Seed terminé.");
  console.log("Comptes de démo (mot de passe: Demo1234!, secret TOTP: JBSWY3DPEHPK3PXP) :");
  console.log("  client@example.com (CLIENT)");
  console.log("  coiffeur1@example.com (COIFFEUR, Salon Étoile - Lyon)");
  console.log("  coiffeur2@example.com (COIFFEUR, Salon Waha - Marseille)");
  console.log("  coiffeur3@example.com (COIFFEUR, Salon Lumière - Paris)");
  console.log("  gestion@example.com (GESTION)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
