const { execSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

// node_modules vive en volúmenes de Docker que no se actualizan al reconstruir la imagen:
// se reinstala cada paquete cuando cambian su package.json o su package-lock.json.
// Está en Node y no en sh porque en Windows Git puede descargar los .sh con CRLF y sh no los ejecuta.
for (const directory of [".", "client", "server"]) {
    const packageDirectory = path.join(root, directory);
    const hash = crypto.createHash("sha256");

    for (const file of ["package.json", "package-lock.json"]) {
        hash.update(fs.readFileSync(path.join(packageDirectory, file)));
    }

    const fingerprint = hash.digest("hex");
    const marker = path.join(packageDirectory, "node_modules", ".docker-deps-fingerprint");
    const installedFingerprint = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : "";

    if (installedFingerprint !== fingerprint) {
        execSync(`npm ci --prefix "${packageDirectory}" --prefer-offline --no-audit --no-fund`, { stdio: "inherit" });
        fs.writeFileSync(marker, `${fingerprint}\n`);
    }
}
