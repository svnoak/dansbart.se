package se.dansbart.dto;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrackSubmissionPageDto {
    private List<TrackSubmissionDto> items;
    private long total;
    private int limit;
    private int offset;
}
