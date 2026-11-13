package se.dansbart.domain.guestcode;

import java.time.OffsetDateTime;
import java.util.UUID;

/** A code that lets its holder add to one playlist or one dance list. Exactly one of the two ids is set. */
public record GuestCode(String code, UUID playlistId, UUID danceListId, UUID createdBy, OffsetDateTime createdAt) {}
