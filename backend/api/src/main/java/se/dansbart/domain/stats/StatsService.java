package se.dansbart.domain.stats;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.dto.StatsDto;

import jakarta.persistence.EntityManager;
import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StatsService {

    private final EntityManager entityManager;

    public StatsDto getLibraryStats() {
        // Total tracks with processing status DONE or FAILED
        Long totalTracks = entityManager.createQuery(
            "SELECT COUNT(t.id) FROM Track t WHERE t.processingStatus IN ('DONE', 'FAILED')",
            Long.class
        ).getSingleResult();

        // Analyzed tracks (distinct tracks in analysis_sources)
        Long analyzed = ((Number) entityManager.createNativeQuery(
            "SELECT COUNT(DISTINCT track_id) FROM analysis_sources"
        ).getSingleResult()).longValue();

        // Classified tracks (distinct tracks in track_dance_styles with DONE/FAILED status)
        Long classified = ((Number) entityManager.createNativeQuery("""
            SELECT COUNT(DISTINCT tds.track_id) FROM track_dance_styles tds
            JOIN tracks t ON tds.track_id = t.id
            WHERE t.processing_status IN ('DONE', 'FAILED')
            """
        ).getSingleResult()).longValue();

        // Last added track date
        OffsetDateTime lastAdded = entityManager.createQuery(
            "SELECT MAX(t.createdAt) FROM Track t WHERE t.processingStatus IN ('DONE', 'FAILED')",
            OffsetDateTime.class
        ).getSingleResult();

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
