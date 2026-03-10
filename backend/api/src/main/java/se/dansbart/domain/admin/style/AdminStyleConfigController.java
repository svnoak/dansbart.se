package se.dansbart.domain.admin.style;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/admin/style-config", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Admin Style Config", description = "Dance style configuration management (beats_per_bar, etc.)")
public class AdminStyleConfigController {

    private final AdminStyleConfigService configService;

    @GetMapping
    @Operation(summary = "Get paginated list of style configs")
    public ResponseEntity<Map<String, Object>> getConfigs(
            @RequestParam(required = false) String mainStyle,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        return ResponseEntity.ok(configService.getConfigsPaginated(mainStyle, limit, offset));
    }

    @GetMapping("/active")
    @Operation(summary = "Get all active style configs")
    public ResponseEntity<List<Map<String, Object>>> getActiveConfigs() {
        return ResponseEntity.ok(configService.getAllActiveConfigs());
    }

    @GetMapping("/{configId}")
    @Operation(summary = "Get a single style config by ID")
    public ResponseEntity<Map<String, Object>> getConfig(@PathVariable UUID configId) {
        try {
            return ResponseEntity.ok(configService.getConfigById(configId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping
    @Operation(summary = "Create a new dance style config")
    public ResponseEntity<Map<String, Object>> createConfig(@RequestBody StyleConfigRequest request) {
        try {
            Map<String, Object> config = configService.createConfig(
                request.mainStyle(), request.subStyle(), request.beatsPerBar());
            return ResponseEntity.ok(Map.of("status", "success", "config", config));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{configId}")
    @Operation(summary = "Update an existing style config")
    public ResponseEntity<Map<String, Object>> updateConfig(
            @PathVariable UUID configId,
            @RequestBody StyleConfigUpdateRequest request) {
        try {
            Map<String, Object> config = configService.updateConfig(
                configId, request.mainStyle(), request.subStyle(),
                request.beatsPerBar(), request.isActive());
            return ResponseEntity.ok(Map.of("status", "success", "config", config));
        } catch (IllegalArgumentException e) {
            if (e.getMessage().contains("not found")) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{configId}")
    @Operation(summary = "Delete a style config")
    public ResponseEntity<Map<String, Object>> deleteConfig(@PathVariable UUID configId) {
        if (configService.deleteConfig(configId)) {
            return ResponseEntity.ok(Map.of("status", "success", "message", "Config deleted"));
        }
        return ResponseEntity.notFound().build();
    }

    public record StyleConfigRequest(
        String mainStyle,
        String subStyle,
        Integer beatsPerBar
    ) {}

    public record StyleConfigUpdateRequest(
        String mainStyle,
        String subStyle,
        Integer beatsPerBar,
        Boolean isActive
    ) {}
}