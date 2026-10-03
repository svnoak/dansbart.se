package se.dansbart.domain.providerconnection;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;

@Slf4j
@Component
public class TokenCipher {

    private static final int VERSION = 0x01;
    private static final int NONCE_BYTES = 12;
    private static final int TAG_BITS = 128;
    private static final int KEY_BYTES = 32;
    private static final String CIPHER_ALGORITHM = "AES/GCM/NoPadding";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final SecretKey secretKey;

    public TokenCipher(@Value("${dansbart.tokens.encryption-key:}") String base64Key) {
        this.secretKey = decodeKey(base64Key);
        if (secretKey == null) {
            log.warn("Token encryption key is not a valid AES-256 key. "
                + "Set TOKEN_ENCRYPTION_KEY to base64 of 32 random bytes.");
        }
    }

    public byte[] encrypt(UUID connectionId, String token) {
        if (secretKey == null) {
            throw new IllegalStateException("Token encryption requires TOKEN_ENCRYPTION_KEY");
        }

        try {
            byte[] tokenBytes = token.getBytes(StandardCharsets.UTF_8);
            byte[] nonce = new byte[NONCE_BYTES];
            SECURE_RANDOM.nextBytes(nonce);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
            GCMParameterSpec spec = new GCMParameterSpec(TAG_BITS, nonce);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec);

            byte[] aad = uuidToBytes(connectionId);
            cipher.updateAAD(aad);

            byte[] ciphertext = cipher.doFinal(tokenBytes);

            ByteBuffer result = ByteBuffer.allocate(1 + NONCE_BYTES + ciphertext.length);
            result.put((byte) VERSION);
            result.put(nonce);
            result.put(ciphertext);

            return result.array();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to encrypt token", e);
        }
    }

    public String decrypt(UUID connectionId, byte[] encrypted) {
        if (secretKey == null) {
            throw new IllegalStateException("Token encryption requires TOKEN_ENCRYPTION_KEY");
        }

        try {
            ByteBuffer buffer = ByteBuffer.wrap(encrypted);

            byte version = buffer.get();
            if (version != VERSION) {
                throw new IllegalStateException("Unknown token encryption version: " + version);
            }

            byte[] nonce = new byte[NONCE_BYTES];
            buffer.get(nonce);

            byte[] ciphertext = new byte[buffer.remaining()];
            buffer.get(ciphertext);

            Cipher cipher = Cipher.getInstance(CIPHER_ALGORITHM);
            GCMParameterSpec spec = new GCMParameterSpec(TAG_BITS, nonce);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);

            byte[] aad = uuidToBytes(connectionId);
            cipher.updateAAD(aad);

            byte[] tokenBytes = cipher.doFinal(ciphertext);
            return new String(tokenBytes, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to decrypt token", e);
        }
    }

    private SecretKey decodeKey(String base64Key) {
        if (base64Key == null || base64Key.isEmpty()) {
            return null;
        }

        try {
            byte[] decodedKey = Base64.getDecoder().decode(base64Key);
            if (decodedKey.length != KEY_BYTES) {
                return null;
            }
            return new SecretKeySpec(decodedKey, 0, decodedKey.length, "AES");
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private byte[] uuidToBytes(UUID uuid) {
        ByteBuffer buffer = ByteBuffer.allocate(16);
        buffer.putLong(uuid.getMostSignificantBits());
        buffer.putLong(uuid.getLeastSignificantBits());
        return buffer.array();
    }
}
