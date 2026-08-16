const net = require("net");

const [, , host, portArg] = process.argv;
const port = Number(portArg);
const timeoutMs = Number(process.env.WAIT_FOR_TCP_TIMEOUT_MS || 60000);
const retryMs = 1000;
const startedAt = Date.now();

if (!host || !Number.isInteger(port)) {
    console.error("Usage: node scripts/wait-for-tcp.js <host> <port>");
    process.exit(1);
}

const retryOrFail = () => {
    if (Date.now() - startedAt >= timeoutMs) {
        console.error(`Timed out waiting for ${host}:${port}`);
        process.exit(1);
    }

    setTimeout(tryConnection, retryMs);
};

const tryConnection = () => {
    let settled = false;
    const socket = net.createConnection({ host, port });
    socket.setTimeout(retryMs);

    socket.once("connect", () => {
        settled = true;
        socket.end();
        console.log(`TCP service ready at ${host}:${port}`);
    });

    socket.once("timeout", () => {
        if (settled) {
            return;
        }

        settled = true;
        socket.destroy();
        retryOrFail();
    });

    socket.once("error", () => {
        if (settled) {
            return;
        }

        settled = true;
        socket.destroy();
        retryOrFail();
    });
};

tryConnection();
