package se.dansbart.domain.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.StyleKeyword;
import se.dansbart.domain.admin.StyleKeywordJooqRepository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StyleService {

    private final StyleKeywordJooqRepository styleKeywordRepository;
    private final DanceStyleConfigJooqRepository styleConfigRepository;

    public List<StyleNode> getStyleTree() {
        List<String> mainStyles = styleKeywordRepository.findDistinctMainStyles();

        // Build lookup of style configs: (mainStyle, subStyle) -> beatsPerBar
        Map<String, Map<String, Integer>> configLookup = styleConfigRepository.findByIsActiveTrue().stream()
            .collect(Collectors.groupingBy(
                DanceStyleConfig::getMainStyle,
                Collectors.toMap(
                    c -> c.getSubStyle() != null ? c.getSubStyle() : "",
                    DanceStyleConfig::getBeatsPerBar,
                    (a, b) -> a
                )
            ));

        return mainStyles.stream()
            .map(mainStyle -> {
                List<String> subStyles = styleKeywordRepository.findSubStylesByMainStyle(mainStyle);
                Map<String, Integer> styleConfigs = configLookup.getOrDefault(mainStyle, Map.of());
                Integer beatsPerBar = styleConfigs.get("");
                return new StyleNode(mainStyle, subStyles, beatsPerBar);
            })
            .toList();
    }

    public List<StyleKeyword> getAllActiveKeywords() {
        return styleKeywordRepository.findByIsActiveTrue();
    }

    public List<DanceStyleConfig> getAllActiveConfigs() {
        return styleConfigRepository.findByIsActiveTrue();
    }

    public record StyleNode(String name, List<String> subStyles, Integer beatsPerBar) {}
}
