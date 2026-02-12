import crypto from "crypto";
import fs from 'fs';

// Define key options
const keyOptions = {
    modulusLength: 2048, // Key size in bits
    publicKeyEncoding: {
        type: 'spki',    // Recommended for public keys
        format: 'pem'    // Export as PEM format
    },
    privateKeyEncoding: {
        type: 'pkcs8',   // Recommended for private keys
        format: 'pem'    // Export as PEM format
    }
};

// Generate the key pair
crypto.generateKeyPair('rsa', keyOptions, (err, publicKey, privateKey) => {
    if (err) {
        console.error('Error generating key pair:', err);
        return;
    }

    // Output keys to files or console
    console.log('Public Key:\n', publicKey);
    console.log('Private Key:\n', privateKey);

    // Optionally save to files
    if (!fs.existsSync("keys")){
        fs.mkdirSync("keys", { recursive: true });
    }
    fs.writeFileSync('keys/public_key.pem', publicKey);
    fs.writeFileSync('keys/private_key.pem', privateKey);
});