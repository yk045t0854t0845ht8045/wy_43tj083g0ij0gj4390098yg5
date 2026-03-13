const readline = require("node:readline");
const { spawnSync } = require("node:child_process");

function runGit(args) {
  const result = spawnSync("git", args, {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Falha ao executar git ${args.join(" ")}: ${result.error.message}`);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Motivo do Commit: ", (answer) => {
  const commitMessage = String(answer || "").trim();
  rl.close();

  if (!commitMessage) {
    console.error("Motivo do commit vazio. Operacao cancelada.");
    process.exit(1);
  }

  runGit(["status"]);
  runGit(["add", "."]);
  runGit(["status"]);
  runGit(["commit", "-m", commitMessage]);
  runGit(["push"]);
});
