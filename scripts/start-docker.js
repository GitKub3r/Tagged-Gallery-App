const { spawnSync } = require("child_process");
const os = require("os");

const PRIVATE_ADDRESS = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
// Adaptadores de Docker, WSL, máquinas virtuales y VPN: su IP no es accesible desde otros dispositivos
const VIRTUAL_INTERFACE = /docker|wsl|vethernet|virtual|vmware|vbox|vnic|bridge|utun|loopback|bluetooth/i;

const findLanAddress = () => {
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
        if (VIRTUAL_INTERFACE.test(name)) {
            continue;
        }

        const lanAddress = addresses.find(({ family, internal, address }) =>
            family === "IPv4" && !internal && PRIVATE_ADDRESS.test(address)
        );

        if (lanAddress) {
            return { name, address: lanAddress.address };
        }
    }

    return null;
};

const lan = findLanAddress();

console.log("\nStarting Tagged with Docker...");

// docker-compose.yml pasa la IP al contenedor, que la muestra en sus logs en cada arranque
const result = spawnSync("docker", ["compose", "up", "-d", "--build"], {
    stdio: "inherit",
    env: { ...process.env, TAGGED_HOST_IP: lan ? lan.address : "" },
});

if (result.error) {
    console.error(`\nCould not run docker: ${result.error.message}`);
    process.exit(1);
}

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

console.log("\nTagged is available at:");
console.log("  This PC: http://localhost:5173");

if (lan) {
    console.log(`  Network: http://${lan.address}:5173 (${lan.name})`);
} else {
    console.log("  Network: LAN IPv4 could not be detected automatically.");
    console.log("\nCheck that Wi-Fi/Ethernet is connected and that the network is private.");
}
