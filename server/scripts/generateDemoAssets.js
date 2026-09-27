// Genera por adelantado los archivos de la biblioteca demo (imágenes, GIF y vídeos) en uploads/demo-assets, para
// que la primera activación del modo demo sea rápida. Sin base de datos. Uso: npm run demo:assets --prefix server
const { DEMO_ASSETS, ensureDemoAssets } = require("../demo/demoAssets");

const startedAt = Date.now();
ensureDemoAssets()
    .then((generated) => {
        console.log(`Demo assets ready: ${generated} generated, ${DEMO_ASSETS.length - generated} already cached (${Math.round((Date.now() - startedAt) / 1000)} s)`);
    })
    .catch((error) => {
        console.error("Could not generate the demo assets:", error);
        process.exit(1);
    });
