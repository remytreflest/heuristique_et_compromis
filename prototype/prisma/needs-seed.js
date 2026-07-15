const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

prisma.user
  .count()
  .then((count) => process.exit(count > 0 ? 1 : 0))
  .catch(() => process.exit(0));
