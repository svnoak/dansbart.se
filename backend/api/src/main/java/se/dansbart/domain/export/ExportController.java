package se.dansbart.domain.export;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
@Tag(name = "Data Export", description = "Public dataset export endpoints (CC BY 4.0)")
public class ExportController {

    private final ExportService exportService;

    @GetMapping("/dataset")
    @Operation(summary = "Export Dansbart's public dataset",
               description = "Includes audio features, classifications, and human feedback. Licensed under CC BY 4.0.")
    public ResponseEntity<Map<String, Object>> exportDataset(
            @Parameter(description = "Limit number of tracks (omit for full export)")
            @RequestParam(required = false) Integer limit,
            @Parameter(description = "Offset for pagination")
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(exportService.exportTracks(limit, offset));
    }

    @GetMapping("/feedback")
    @Operation(summary = "Export aggregated human feedback and ground truth data",
               description = "Includes style votes, movement feedback, and structure annotations.")
    public ResponseEntity<Map<String, Object>> exportFeedback() {
        return ResponseEntity.ok(exportService.exportFeedback());
    }

    @GetMapping("/stats")
    @Operation(summary = "Get statistics about the available export dataset",
               description = "Useful for understanding dataset size before downloading.")
    public ResponseEntity<Map<String, Object>> getExportStats() {
        return ResponseEntity.ok(exportService.getExportStats());
    }
}
