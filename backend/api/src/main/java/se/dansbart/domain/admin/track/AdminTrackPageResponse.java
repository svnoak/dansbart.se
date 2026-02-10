package se.dansbart.domain.admin.track;

import org.springframework.data.domain.Page;
import java.util.List;

/**
 * Concrete page response type for AdminTrackDto.
 * This explicit type ensures SpringDoc correctly generates the OpenAPI schema
 * instead of falling back to generic PageTrack.
 */
public record AdminTrackPageResponse(
    List<AdminTrackDto> items,
    long total,
    int page,
    int size,
    boolean hasMore
) {
    /**
     * Create an AdminTrackPageResponse from a Spring Page object.
     */
    public static AdminTrackPageResponse from(Page<AdminTrackDto> page) {
        return new AdminTrackPageResponse(
            page.getContent(),
            page.getTotalElements(),
            page.getNumber(),
            page.getSize(),
            !page.isLast()
        );
    }
}
