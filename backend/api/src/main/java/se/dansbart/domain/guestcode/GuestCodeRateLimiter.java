package se.dansbart.domain.guestcode;

import org.springframework.stereotype.Component;
import se.dansbart.exception.TooManyRequestsException;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Caps how often one address may call the guest code endpoints. The endpoints need no
 * login, so this is what slows down guessing codes and flooding a list. The counters
 * live in memory: each API instance counts on its own, and a restart clears them.
 */
@Component
public class GuestCodeRateLimiter {

    static final int MAX_REQUESTS_PER_WINDOW = 60;
    static final long WINDOW_MILLIS = 60_000;
    private static final int MAX_TRACKED_ADDRESSES = 50_000;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public void check(String address) {
        check(address, System.currentTimeMillis());
    }

    void check(String address, long now) {
        if (windows.size() > MAX_TRACKED_ADDRESSES) {
            windows.values().removeIf(window -> now - window.start >= WINDOW_MILLIS);
        }
        Window window = windows.compute(address == null ? "" : address, (key, current) ->
            current == null || now - current.start >= WINDOW_MILLIS
                ? new Window(now, 1)
                : new Window(current.start, current.count + 1));
        if (window.count > MAX_REQUESTS_PER_WINDOW) {
            throw new TooManyRequestsException("Too many requests. Wait a minute and try again.");
        }
    }

    private record Window(long start, int count) {}
}
