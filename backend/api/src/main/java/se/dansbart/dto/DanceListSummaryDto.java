package se.dansbart.dto;

import java.util.UUID;

public record DanceListSummaryDto(UUID id, String name, String description, Boolean isPublic) {}
