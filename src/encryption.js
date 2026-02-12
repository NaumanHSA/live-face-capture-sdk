export async function generateSecretExecutionData(data, publicKey, version) {
    try {
        // Generate random AES key and IV
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const randomKeyString = Array.from(
            { length: 32 },
            () => charset[Math.floor(Math.random() * charset.length)]
        ).join('');
        const aesKey = new TextEncoder().encode(randomKeyString); // AES key as Uint8Array
        // Generate IV
        const ivLength = version ? 12 : 16;
        const aesIV = window.crypto.getRandomValues(new Uint8Array(ivLength)); // Random IV
        // Encrypt the AES key with RSA
        const aesKeyBase64 = btoa(String.fromCharCode(...aesKey)); // Convert Uint8Array to Base64
        const rsaEncryptedBase64AESKey = await encryptMessageWithRSA(aesKeyBase64, publicKey);
        // Encrypt the JSON command with AES
        const plainText = new TextEncoder().encode(data); // Encode plaintext as Uint8Array

        let cipherText, authTag;
        if (version) {
            // AES-GCM encryption
            const algorithm = { name: 'AES-GCM', iv: aesIV, tagLength: 128 };
            const key = await window.crypto.subtle.importKey('raw', aesKey, algorithm, false, ['encrypt']);
            const encrypted = await window.crypto.subtle.encrypt(algorithm, key, plainText);
            cipherText = new Uint8Array(encrypted);
            authTag = cipherText.slice(-16); // Extract the last 16 bytes as the Auth Tag
            cipherText = cipherText.slice(0, -16); // Exclude the Auth Tag from the ciphertext
        } else {
            // AES-CBC encryption
            const algorithm = { name: 'AES-CBC', iv: aesIV };
            const key = await window.crypto.subtle.importKey('raw', aesKey, algorithm, false, ['encrypt']);
            cipherText = new Uint8Array(await window.crypto.subtle.encrypt(algorithm, key, plainText));
        }
        // Encode AES IV and ciphertext to Base64
        const aesIVBase64 = btoa(String.fromCharCode(...aesIV));
        const encryptedBase64Data = uint8ArrayToBase64(cipherText);
        // const encryptedBase64Data = btoa(String.fromCharCode(...cipherText));
        if (version) {
            const authTagBase64 = btoa(String.fromCharCode(...authTag));
            return `${encryptedBase64Data}.${rsaEncryptedBase64AESKey}.${aesIVBase64}.${authTagBase64}`;
        } else {
            return `${encryptedBase64Data}.${rsaEncryptedBase64AESKey}.${aesIVBase64}`;
        }
    } catch (e) {
        console.error('Error in generateSecretExecutionData:', e);
        throw new Error(`Failed to generate secret execution data: ${e.message}`);
    }
}


async function encryptMessageWithRSA(plainText, publicKey) {
    try {
        // Convert Base64 string to Uint8Array
        const data = Uint8Array.from(atob(plainText), (char) => char.charCodeAt(0));

        // Import the RSA public key
        const keyAlgorithm = {
            name: "RSA-OAEP",
            hash: { name: "SHA-256" }, // Ensure the hash algorithm matches your requirements
        };
        const importedPublicKey = await window.crypto.subtle.importKey(
            "spki", // Assuming the public key is in SPKI format
            Uint8Array.from(atob(getSpkiDer(publicKey)), (char) => char.charCodeAt(0)),
            keyAlgorithm,
            true,
            ["encrypt"]
        );

        // Encrypt the data
        const encryptedData = await window.crypto.subtle.encrypt(
            keyAlgorithm,
            importedPublicKey,
            data
        );

        // Convert encrypted data to Base64
        const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
        return encryptedBase64;
    } catch (e) {
        console.error("PKC-ENCRYPT-MESSAGE-WITH-RSA", e.message, e);
        return '';
    }
}


/**
 * Decrypts the encrypted data produced by `generateSecretExecutionData`.
 * @param {string} encryptedData - The Base64 encoded data string (format: <encryptedBase64Data>.<rsaEncryptedBase64AESKey>.<aesIVBase64>).
 * @param {CryptoKey} privateKey - The RSA private key (CryptoKey object) for decryption of AES key.
 * @param {boolean} version - Whether to use AES-GCM (true) or AES-CBC (false).
 * @returns {Promise<string>} - The decrypted plaintext.
 */
export async function decryptSecretExecutionData(encryptedData, privateKeyBase64, version) {
    try {
        // Split the encrypted data into its components
        const [encryptedBase64Data, rsaEncryptedBase64AESKey, aesIVBase64, authTagBase64] = encryptedData.split('.');
        if (!encryptedBase64Data || !rsaEncryptedBase64AESKey || !aesIVBase64) {
            throw new Error('Invalid encrypted data format.');
        }
        // Helper to decode Base64 to Uint8Array
        const base64ToUint8Array = (base64) =>
            Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        // Step 1: Decrypt the AES key using RSA private key
        const encryptedAESKey = base64ToUint8Array(rsaEncryptedBase64AESKey);
        const privateKey = await window.crypto.subtle.importKey(
            "pkcs8",
            base64ToUint8Array(getSpkiDer(privateKeyBase64)),
            { name: "RSA-OAEP", hash: "SHA-256" },
            false,
            ["decrypt"]
        );
        const decryptedAESKey = await window.crypto.subtle.decrypt(
            {
                name: "RSA-OAEP", // RSA-OAEP as standard padding for Web Crypto
            },
            privateKey,
            encryptedAESKey
        );
        const aesKey = new Uint8Array(decryptedAESKey);
        // Step 2: Decode the AES IV and encrypted data
        const aesIV = base64ToUint8Array(aesIVBase64);
        const encryptedCipherText = base64ToUint8Array(encryptedBase64Data);
        // Step 3: Decrypt the ciphertext
        let decryptedData;
        if (version) {
            // AES-GCM decryption
            const authTag = base64ToUint8Array(authTagBase64);
            const cipherText = encryptedCipherText.slice(0, -authTag.length);
            const key = await window.crypto.subtle.importKey(
                "raw",
                aesKey,
                { name: "AES-GCM" },
                false,
                ["decrypt"]
            );
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: aesIV, tagLength: 128, additionalData: authTag },
                key,
                cipherText
            );
            decryptedData = new TextDecoder().decode(decrypted);
        } else {
            // AES-CBC decryption
            const key = await window.crypto.subtle.importKey(
                "raw",
                aesKey,
                { name: "AES-CBC" },
                false,
                ["decrypt"]
            );

            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-CBC", iv: aesIV },
                key,
                encryptedCipherText
            );
            decryptedData = new TextDecoder().decode(decrypted);
        }
        // Return the plaintext as a string
        return decryptedData;
    } catch (error) {
        console.error("Decryption failed:", error.message);
        throw new Error("Decryption error: " + error.message);
    }
}


function getSpkiDer(spkiPem) {
    const pemHeaderPub = "-----BEGIN PUBLIC KEY-----";
    const pemFooterPub = "-----END PUBLIC KEY-----";
    const pemHeaderPri = "-----BEGIN PRIVATE KEY-----";
    const pemFooterPri = "-----END PRIVATE KEY-----";
    const pemContents = spkiPem
        .replace(pemHeaderPub, "")
        .replace(pemFooterPub, "")
        .replace(pemHeaderPri, "")
        .replace(pemFooterPri, "")
        .replace(/\n/g, ""); // Remove newlines
    return pemContents;
}


function uint8ArrayToBase64(uint8Array) {
    let binary = '';
    const len = uint8Array.length;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
}

