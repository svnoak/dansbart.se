package se.dansbart.dto.request;

import lombok.*;

import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionCreateRequest {
    private String kind; // "content" | "dance_style"
    private Map<String, Object> payload;
    private String note;
}
