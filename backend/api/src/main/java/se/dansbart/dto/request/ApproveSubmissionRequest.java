package se.dansbart.dto.request;

/**
 * Optional style the admin settled on. When both are null the suggested style on the
 * submission is kept; an empty string clears it so no style vote is cast.
 */
public record ApproveSubmissionRequest(String mainStyle, String subStyle) {}
