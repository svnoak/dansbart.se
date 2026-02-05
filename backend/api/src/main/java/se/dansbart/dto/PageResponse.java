package se.dansbart.dto;

import org.springframework.data.domain.Page;
import java.util.List;

/**
 * Generic pagination response DTO that matches frontend expectations.
 * Frontend expects: { items: [], total: number }
 * Spring Page returns: { content: [], totalElements: number }
 */
public record PageResponse<T>(
    List<T> items,
    long total,
    int page,
    int size,
    boolean hasMore
) {
    /**
     * Create a PageResponse from a Spring Page object.
     */
    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(
            page.getContent(),
            page.getTotalElements(),
            page.getNumber(),
            page.getSize(),
            !page.isLast()
        );
    }
}
