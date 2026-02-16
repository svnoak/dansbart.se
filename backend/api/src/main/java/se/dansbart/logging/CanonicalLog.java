package se.dansbart.logging;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Accumulates context fields during a request lifecycle.
 * The TraceFilter emits one canonical log line per request
 * containing all accumulated fields.
 *
 * Services can enrich the canonical log:
 * <pre>
 *   CanonicalLog.current().put("trackId", trackId);
 *   CanonicalLog.current().put("tasksDispatched", 3);
 * </pre>
 */
public class CanonicalLog {

    private static final ThreadLocal<CanonicalLog> CURRENT = new ThreadLocal<>();

    private final Map<String, Object> fields = new LinkedHashMap<>();

    public void put(String key, Object value) {
        fields.put(key, value);
    }

    public Map<String, Object> getFields() {
        return fields;
    }

    public static CanonicalLog current() {
        return CURRENT.get();
    }

    static void set(CanonicalLog log) {
        CURRENT.set(log);
    }

    static void clear() {
        CURRENT.remove();
    }
}
