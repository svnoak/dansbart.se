package se.dansbart.domain.stats;

import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.dto.StatsDto;

import java.time.OffsetDateTime;

import static org.jooq.impl.DSL.countDistinct;
import static org.jooq.impl.DSL.max;
import static se.dansbart.jooq.Tables.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StatsService {

    private final DSLContext dsl;

    public StatsDto getLibraryStats() {
        var statusCondition = TRACKS.PROCESSING_STATUS.in("DONE", "FAILED");

        // Total tracks with processing status DONE or FAILED
        Long totalTracks = dsl.selectCount()
            .from(TRACKS)
            .where(statusCondition)
            .fetchOne(0, Long.class);

        // Analyzed tracks (distinct tracks in analysis_sources)
        Long analyzed = dsl.select(countDistinct(ANALYSIS_SOURCES.TRACK_ID))
            .from(ANALYSIS_SOURCES)
            .fetchOne(0, Long.class);

        // Classified tracks (distinct tracks in track_dance_styles with DONE/FAILED status)
        Long classified = dsl.select(countDistinct(TRACK_DANCE_STYLES.TRACK_ID))
            .from(TRACK_DANCE_STYLES)
            .join(TRACKS).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .where(statusCondition)
            .fetchOne(0, Long.class);

        // Last added track date
        var maxCreated = dsl.select(max(TRACKS.CREATED_AT)).from(TRACKS).where(statusCondition).fetchOne();
        OffsetDateTime lastAdded = maxCreated != null ? maxCreated.get(0, OffsetDateTime.class) : null;

        // Calculate derived values
        long pendingAnalysis = totalTracks - analyzed;
        long pendingClassification = analyzed - classified;
        int coveragePercent = totalTracks > 0
            ? (int) ((classified * 100) / totalTracks)
            : 0;

        return StatsDto.builder()
            .totalTracks(totalTracks)
            .analyzed(analyzed)
            .classified(classified)
            .pendingAnalysis(pendingAnalysis)
            .pendingClassification(pendingClassification)
            .coveragePercent(coveragePercent)
            .lastAdded(lastAdded)
            .build();
    }
}
