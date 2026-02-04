package se.dansbart.dto.response;

import lombok.*;

import java.util.List;

/**
 * Generic paginated response wrapper.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PageResponse<T> {

    private List<T> items;
    private long totalItems;
    private int totalPages;
    private int currentPage;
    private int pageSize;
    private boolean hasNext;
    private boolean hasPrevious;

    public static <T> PageResponse<T> of(
            List<T> items,
            long totalItems,
            int currentPage,
            int pageSize
    ) {
        int totalPages = (int) Math.ceil((double) totalItems / pageSize);
        return PageResponse.<T>builder()
                .items(items)
                .totalItems(totalItems)
                .totalPages(totalPages)
                .currentPage(currentPage)
                .pageSize(pageSize)
                .hasNext(currentPage < totalPages - 1)
                .hasPrevious(currentPage > 0)
                .build();
    }
}
