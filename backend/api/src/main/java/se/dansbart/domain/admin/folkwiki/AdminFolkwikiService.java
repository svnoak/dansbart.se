package se.dansbart.domain.admin.folkwiki;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.StyleKeywordJooqRepository;
import se.dansbart.worker.TaskDispatcher;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminFolkwikiService {

    private final FolkwikiMatchJooqRepository matchRepository;
    private final StyleKeywordJooqRepository styleKeywordRepository;
    private final TaskDispatcher taskDispatcher;

    @Transactional(readOnly = true)
    public Map<String, Object> getMatches(String status, int limit, int offset) {
        List<FolkwikiMatchDto> matches = matchRepository.findByStatus(status, limit, offset);
        int total = matchRepository.countByStatus(status);

        return Map.of(
            "items", matches,
            "total", total,
            "limit", limit,
            "offset", offset
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Integer> getStatusCounts() {
        int pending = matchRepository.countByStatus("pending");
        int confirmed = matchRepository.countByStatus("confirmed");
        int rejected = matchRepository.countByStatus("rejected");

        return Map.of(
            "pending", pending,
            "confirmed", confirmed,
            "rejected", rejected,
            "total", pending + confirmed + rejected
        );
    }

    @Transactional
    public Map<String, Object> importTunesAndMatch(List<FolkwikiTuneImport> tunes) {
        int upserted = matchRepository.upsertTunes(tunes);
        int newMatches = matchRepository.runMatching();

        return Map.of(
            "status", "success",
            "tunesImported", upserted,
            "tunesTotal", tunes.size(),
            "newMatches", newMatches
        );
    }

    public Map<String, Object> backfillBars() {
        var tracks = matchRepository.findAllPrimaryTrackStyles();
        for (var t : tracks) {
            taskDispatcher.dispatchCorrectBars(
                UUID.fromString(t.get("trackId")),
                t.get("danceStyle"),
                t.get("subStyle")
            );
        }
        return Map.of("dispatched", tracks.size());
    }

    @Transactional
    public Map<String, Object> correctTuneStyle(int folkwikiTuneId, String newStyle) {
        if (newStyle == null || newStyle.isBlank()) {
            throw new IllegalArgumentException("Style får inte vara tomt");
        }
        boolean updated = matchRepository.updateTuneStyle(folkwikiTuneId, newStyle.strip());
        if (!updated) {
            throw new IllegalArgumentException("Folkwiki-låt hittades inte");
        }
        return Map.of("status", "success", "folkwikiTuneId", folkwikiTuneId, "style", newStyle.strip());
    }

    @Transactional
    public Map<String, Object> confirmMatch(UUID trackId, int folkwikiTuneId, boolean force) {
        String folkwikiStyle = matchRepository.getFolkwikiStyle(folkwikiTuneId);
        if (folkwikiStyle == null) {
            throw new IllegalArgumentException("Folkwiki tune not found");
        }

        // Check if the folkwiki style maps to any known keyword
        if (!force && !styleKeywordRepository.existsByMainStyleOrSubStyle(folkwikiStyle)) {
            List<String> knownStyles = styleKeywordRepository.findDistinctMainStyles();
            Map<String, Object> result = new HashMap<>();
            result.put("status", "style_unknown");
            result.put("folkwikiStyle", folkwikiStyle);
            result.put("knownStyles", knownStyles);
            result.put("trackId", trackId.toString());
            result.put("folkwikiTuneId", folkwikiTuneId);
            return result;
        }

        boolean updated = matchRepository.updateStatus(trackId, folkwikiTuneId, "confirmed", "admin");
        if (!updated) {
            throw new IllegalArgumentException("Match not found");
        }

        // Update the track's dance style to match folkwiki
        matchRepository.updateTrackClassification(trackId, folkwikiStyle);

        // Re-derive bar positions for the new style (best-effort, no rollback on failure)
        taskDispatcher.dispatchCorrectBars(trackId, folkwikiStyle, null);

        return Map.of(
            "status", "success",
            "trackId", trackId.toString(),
            "appliedStyle", folkwikiStyle
        );
    }

    @Transactional
    public Map<String, Object> rejectMatch(UUID trackId, int folkwikiTuneId, String overrideStyle) {
        boolean updated = matchRepository.updateStatus(trackId, folkwikiTuneId, "rejected", "admin");
        if (!updated) {
            throw new IllegalArgumentException("Match not found");
        }

        if (overrideStyle != null && !overrideStyle.isBlank()) {
            matchRepository.updateTrackClassification(trackId, overrideStyle);
            taskDispatcher.dispatchCorrectBars(trackId, overrideStyle, null);
            Map<String, Object> result = new HashMap<>();
            result.put("status", "success");
            result.put("trackId", trackId.toString());
            result.put("appliedStyle", overrideStyle);
            return result;
        }

        return Map.of(
            "status", "success",
            "trackId", trackId.toString()
        );
    }
}
