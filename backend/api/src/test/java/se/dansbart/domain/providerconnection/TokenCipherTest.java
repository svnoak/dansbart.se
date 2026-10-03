package se.dansbart.domain.providerconnection;

import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TokenCipherTest {

    private static final String VALID_KEY = buildValidKey();
    private static final UUID CONNECTION_ID = UUID.randomUUID();
    private static final String TEST_TOKEN = "test-refresh-token-value";

    private static String buildValidKey() {
        byte[] keyBytes = new byte[32];
        for (int i = 0; i < 32; i++) {
            keyBytes[i] = (byte) i;
        }
        return Base64.getEncoder().encodeToString(keyBytes);
    }

    @Test
    void decryptsWhatItEncrypted() {
        TokenCipher cipher = new TokenCipher(VALID_KEY);

        byte[] encrypted = cipher.encrypt(CONNECTION_ID, TEST_TOKEN);
        String decrypted = cipher.decrypt(CONNECTION_ID, encrypted);

        assertEquals(TEST_TOKEN, decrypted);
    }

    @Test
    void startsWithVersionOneAndUsesAFreshNonce() {
        TokenCipher cipher = new TokenCipher(VALID_KEY);

        byte[] encrypted1 = cipher.encrypt(CONNECTION_ID, TEST_TOKEN);
        byte[] encrypted2 = cipher.encrypt(CONNECTION_ID, TEST_TOKEN);

        assertEquals(0x01, encrypted1[0]);
        assertEquals(0x01, encrypted2[0]);
        assertNotEquals(encrypted1, encrypted2);

        int expectedLength = 1 + 12 + TEST_TOKEN.getBytes().length + 16;
        assertEquals(expectedLength, encrypted1.length);
    }

    @Test
    void rejectsATamperedCiphertext() {
        TokenCipher cipher = new TokenCipher(VALID_KEY);

        byte[] encrypted = cipher.encrypt(CONNECTION_ID, TEST_TOKEN);
        encrypted[14]++;

        assertThrows(Exception.class, () -> cipher.decrypt(CONNECTION_ID, encrypted));
    }

    @Test
    void rejectsADifferentConnectionId() {
        TokenCipher cipher = new TokenCipher(VALID_KEY);

        byte[] encrypted = cipher.encrypt(CONNECTION_ID, TEST_TOKEN);
        UUID differentId = UUID.randomUUID();

        assertThrows(Exception.class, () -> cipher.decrypt(differentId, encrypted));
    }

    @Test
    void rejectsAnUnknownVersion() {
        TokenCipher cipher = new TokenCipher(VALID_KEY);

        byte[] encrypted = cipher.encrypt(CONNECTION_ID, TEST_TOKEN);
        encrypted[0] = 0x02;

        assertThrows(Exception.class, () -> cipher.decrypt(CONNECTION_ID, encrypted));
    }

    @Test
    void refusesToWorkWithoutAKey() {
        TokenCipher cipher = new TokenCipher("");

        assertThrows(IllegalStateException.class, () -> cipher.encrypt(CONNECTION_ID, TEST_TOKEN));
    }

    @Test
    void refusesAKeyThatIsNotThirtyTwoBytes() {
        byte[] shortKeyBytes = new byte[16];
        for (int i = 0; i < 16; i++) {
            shortKeyBytes[i] = (byte) i;
        }
        String shortKey = Base64.getEncoder().encodeToString(shortKeyBytes);

        TokenCipher cipher = new TokenCipher(shortKey);

        assertThrows(IllegalStateException.class, () -> cipher.encrypt(CONNECTION_ID, TEST_TOKEN));
    }
}
