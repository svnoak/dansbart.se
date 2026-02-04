package se.dansbart.domain.stats;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import se.dansbart.dto.StatsDto;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
@Tag(name = "Stats", description = "Library statistics")
public class StatsController {

    private final StatsService statsService;

    @GetMapping
    @Operation(summary = "Get library statistics")
    public ResponseEntity<StatsDto> getStats() {
        return ResponseEntity.ok(statsService.getLibraryStats());
    }
}
