// Serveur Next.js clusterise : plusieurs process worker (module "cluster" de Node), chacun avec
// sa propre boucle d'evenements et son propre threadpool libuv, plutot qu'un unique process
// "next start". Teste empiriquement suite a performance/BRIEF-CLAUDE-WEB.md §6.6 : le plafond CPU
// observe sous charge (~330-350% sur 1200% disponibles, inchange par UV_THREADPOOL_SIZE) pointait
// vers la capacite d'un seul process, pas vers un manque de threads pour le hachage scrypt.
const cluster = require("node:cluster");
const os = require("node:os");
const http = require("node:http");
const next = require("next");

const port = parseInt(process.env.PORT || "3000", 10);
const numWorkers = parseInt(process.env.WEB_CONCURRENCY || String(os.cpus().length), 10);

if (cluster.isPrimary) {
  console.log(`[cluster] primaire ${process.pid} : demarrage de ${numWorkers} workers`);
  for (let i = 0; i < numWorkers; i += 1) {
    cluster.fork();
  }
  cluster.on("exit", (worker, code, signal) => {
    console.error(`[cluster] worker ${worker.process.pid} arrete (${signal || code}) — redemarrage`);
    cluster.fork();
  });
} else {
  const app = next({ dev: false, dir: __dirname });
  const handle = app.getRequestHandler();
  app.prepare().then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, () => {
        console.log(`[cluster] worker ${process.pid} pret sur le port ${port}`);
      });
  });
}
