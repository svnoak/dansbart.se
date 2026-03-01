package se.dansbart.domain.admin;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import org.springframework.http.MediaType;

@RestController
@RequestMapping(value = "/api/styles", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "Styles", description = "Dance style endpoints")
public class StyleController {

    private final StyleService styleService;

    @GetMapping("/tree")
    @Operation(summary = "Get dance style hierarchy tree")
    public ResponseEntity<List<StyleService.StyleNode>> getStyleTree() {
        return ResponseEntity.ok(styleService.getStyleTree());
    }

    @GetMapping("/keywords")
    @Operation(summary = "Get all active style keywords")
    public ResponseEntity<List<StyleKeyword>> getKeywords() {
        return ResponseEntity.ok(styleService.getAllActiveKeywords());
    }
}
