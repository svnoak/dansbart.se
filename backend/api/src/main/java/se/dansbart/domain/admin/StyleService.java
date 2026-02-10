package se.dansbart.domain.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.StyleKeyword;
import se.dansbart.domain.admin.StyleKeywordJooqRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StyleService {

    private final StyleKeywordJooqRepository styleKeywordRepository;

    public List<StyleNode> getStyleTree() {
        List<String> mainStyles = styleKeywordRepository.findDistinctMainStyles();

        return mainStyles.stream()
            .map(mainStyle -> {
                List<String> subStyles = styleKeywordRepository.findSubStylesByMainStyle(mainStyle);
                return new StyleNode(mainStyle, subStyles);
            })
            .toList();
    }

    public List<StyleKeyword> getAllActiveKeywords() {
        return styleKeywordRepository.findByIsActiveTrue();
    }

    public record StyleNode(String name, List<String> subStyles) {}
}
