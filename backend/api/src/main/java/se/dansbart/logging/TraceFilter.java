package se.dansbart.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

/**
 * Servlet filter that provides distributed tracing and canonical request logging.
 *
 * On every request:
 * 1. Reads X-Trace-Id header (from frontend) or generates a new UUID
 * 2. Sets traceId, method, path in SLF4J MDC (included in all log lines)
 * 3. Adds X-Trace-Id response header for frontend correlation
 * 4. Initializes a CanonicalLog for services to enrich
 * 5. On completion, emits one canonical log line summarizing the request
 *
 * Ordered to run before Spring Security so trace IDs appear on auth failures too.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class TraceFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(TraceFilter.class);

    private static final String TRACE_HEADER = "X-Trace-Id";
    private static final String MDC_TRACE_ID = "traceId";
    private static final String MDC_METHOD = "method";
    private static final String MDC_PATH = "path";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        long startTime = System.currentTimeMillis();

        String traceId = request.getHeader(TRACE_HEADER);
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString();
        }

        String method = request.getMethod();
        String path = request.getRequestURI();

        MDC.put(MDC_TRACE_ID, traceId);
        MDC.put(MDC_METHOD, method);
        MDC.put(MDC_PATH, path);

        response.setHeader(TRACE_HEADER, traceId);

        CanonicalLog canonical = new CanonicalLog();
        CanonicalLog.set(canonical);

        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = System.currentTimeMillis() - startTime;
            int status = response.getStatus();

            Map<String, Object> extra = canonical.getFields();

            if (status >= 500) {
                log.error("request.completed traceId={} method={} path={} status={} duration_ms={} {}",
                        traceId, method, path, status, durationMs, extra);
            } else if (status >= 400) {
                log.warn("request.completed traceId={} method={} path={} status={} duration_ms={} {}",
                        traceId, method, path, status, durationMs, extra);
            } else {
                log.info("request.completed traceId={} method={} path={} status={} duration_ms={} {}",
                        traceId, method, path, status, durationMs, extra);
            }

            CanonicalLog.clear();
            MDC.remove(MDC_TRACE_ID);
            MDC.remove(MDC_METHOD);
            MDC.remove(MDC_PATH);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator/");
    }
}
