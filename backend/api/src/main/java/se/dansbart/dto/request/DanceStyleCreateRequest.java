package se.dansbart.dto.request;

/**
 * Add a dance style. With parentStyle null the style becomes a new main style;
 * otherwise it becomes a sub-style of that existing main style.
 */
public record DanceStyleCreateRequest(String name, String parentStyle) {}
