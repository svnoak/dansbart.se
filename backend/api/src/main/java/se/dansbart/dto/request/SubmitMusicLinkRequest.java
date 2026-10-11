package se.dansbart.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** The link a person pasted on the "Lägg till musik" page. */
public record SubmitMusicLinkRequest(@NotBlank @Size(max = 2048) String url) {}
