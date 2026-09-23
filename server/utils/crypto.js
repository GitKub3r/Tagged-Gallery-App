const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

// Clave de 32 bytes en base64 (GOOGLE_TOKEN_ENCRYPTION_KEY). Generar con: openssl rand -base64 32
const getKey = () => {
    const key = Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "", "base64");
    if (key.length !== 32) {
        throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    }
    return key;
};

const hasEncryptionKey = () => {
    try {
        getKey();
        return true;
    } catch {
        return false;
    }
};

// Devuelve "iv.authTag.cipherText" en base64url.
const encrypt = (plainText) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
};

const decrypt = (payload) => {
    const [iv, authTag, encrypted] = String(payload || "").split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

module.exports = { encrypt, decrypt, hasEncryptionKey };
