package se.dansbart.domain.guestcode;

import org.junit.jupiter.api.Test;
import se.dansbart.exception.TooManyRequestsException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GuestCodeRateLimiterTest {

    @Test
    void blocksAnAddressOverTheLimitAndLetsItInAgainAfterTheWindow() {
        GuestCodeRateLimiter limiter = new GuestCodeRateLimiter();
        long start = 1_000_000;
        for (int i = 0; i < GuestCodeRateLimiter.MAX_REQUESTS_PER_WINDOW; i++) {
            limiter.check("10.0.0.1", start);
        }

        assertThatThrownBy(() -> limiter.check("10.0.0.1", start + 1))
            .isInstanceOf(TooManyRequestsException.class);
        assertThatCode(() -> limiter.check("10.0.0.2", start + 1)).doesNotThrowAnyException();
        assertThatCode(() -> limiter.check("10.0.0.1", start + GuestCodeRateLimiter.WINDOW_MILLIS))
            .doesNotThrowAnyException();
    }
}
