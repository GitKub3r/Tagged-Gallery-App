const { OAuth2Client } = require("google-auth-library");
const GoogleDriveConnectionModel = require("../models/GoogleDriveConnection.model");
const AuditService = require("./Audit.service");
const { encrypt, decrypt, hasEncryptionKey } = require("../utils/crypto");

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
// drive.file: la app solo accede a los archivos que el usuario elige en el Picker.
const OAUTH_SCOPES = [DRIVE_FILE_SCOPE, "openid", "email"];

const isConfigured = () =>
    Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_API_KEY && process.env.GOOGLE_APP_ID) &&
    hasEncryptionKey();

// Con el flujo de código en ventana emergente de Google Identity Services, el redirect_uri es "postmessage".
const createOAuthClient = () =>
    new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, "postmessage");

const forbidAdmin = (user) =>
    user.type === "admin" ? { error: "Google Drive is only available for library accounts", status: 403 } : null;

const notConfigured = () => ({ error: "Google Drive integration is not configured on the server", status: 503 });

const toStatus = (connection) => ({
    configured: true,
    // Datos públicos que el cliente necesita para Google Identity Services y el Picker.
    config: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        apiKey: process.env.GOOGLE_API_KEY,
        appId: process.env.GOOGLE_APP_ID,
        scopes: OAUTH_SCOPES,
    },
    connected: Boolean(connection && connection.status === "connected"),
    status: connection?.status || "disconnected",
    email: connection?.google_account_email || null,
    connectedAt: connection?.updated_at || null,
});

class GoogleDriveService {
    static async getStatus(user) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        if (!isConfigured()) return { data: { configured: false, connected: false, status: "disconnected" } };

        return { data: toStatus(await GoogleDriveConnectionModel.findByUserId(user.id)) };
    }

    static async connect(code, user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;
        if (!isConfigured()) return notConfigured();
        if (typeof code !== "string" || !code.trim()) return { error: "Authorization code is required", status: 400 };

        const client = createOAuthClient();
        let tokens;
        try {
            ({ tokens } = await client.getToken(code.trim()));
        } catch (error) {
            console.error("Google Drive code exchange failed:", error.response?.data || error.message);
            return { error: "Google rejected the authorization. Please try connecting again.", status: 400 };
        }

        const grantedScopes = String(tokens.scope || "").split(" ");
        if (!grantedScopes.includes(DRIVE_FILE_SCOPE)) {
            return { error: "Tagged needs access to the Drive files you select. Please allow it and try again.", status: 400 };
        }
        if (!tokens.refresh_token) {
            return { error: "Google did not grant offline access. Please try connecting again.", status: 400 };
        }

        let email = null;
        if (tokens.id_token) {
            const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
            email = ticket.getPayload()?.email || null;
        }

        const connection = await GoogleDriveConnectionModel.upsert({
            userId: user.id,
            email,
            refreshTokenEncrypted: encrypt(tokens.refresh_token),
            scopes: grantedScopes.join(" "),
        });
        // Al reconectar, las medias de Drive vuelven a estar accesibles; la comprobación de estado corregirá las que falten.
        await GoogleDriveConnectionModel.markUserMediaStatus(user.id, "available");
        await AuditService.logEvent({ actionCode: "GOOGLE_DRIVE_CONNECT", req, statusCode: 200, message: "Google Drive connected" });

        return { data: toStatus(connection) };
    }

    static async disconnect(user, req) {
        const forbidden = forbidAdmin(user);
        if (forbidden) return forbidden;

        const connection = await GoogleDriveConnectionModel.findByUserId(user.id);
        if (!connection) return { error: "Google Drive is not connected", status: 404 };

        try {
            await createOAuthClient().revokeToken(decrypt(connection.refresh_token_encrypted));
        } catch (error) {
            // El token puede estar ya revocado desde la cuenta de Google; la desconexión local sigue adelante.
            console.warn("Google Drive token revocation failed:", error.response?.data || error.message);
        }

        await GoogleDriveConnectionModel.deleteByUserId(user.id);
        await GoogleDriveConnectionModel.markUserMediaStatus(user.id, "revoked");
        await AuditService.logEvent({ actionCode: "GOOGLE_DRIVE_DISCONNECT", req, statusCode: 200, message: "Google Drive disconnected" });

        return { data: isConfigured() ? toStatus(null) : { configured: false, connected: false, status: "disconnected" } };
    }
}

module.exports = GoogleDriveService;
