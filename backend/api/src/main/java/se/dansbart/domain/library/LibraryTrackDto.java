package se.dansbart.domain.library;

import se.dansbart.dto.TrackListDto;

import java.util.List;

public record LibraryTrackDto(TrackListDto track, boolean linkedToCatalog, List<LibrarySourceRefDto> sources) {}
